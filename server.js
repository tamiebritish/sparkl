const express = require('express');
const path = require('path');
const { all, get, run, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function mapCleanerRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    profileEmoji: row.profile_emoji,
    profileBg: row.profile_bg,
    neighbourhood: row.neighbourhood,
    city: row.city,
    hourlyRate: row.hourly_rate,
    services: JSON.parse(row.services_json),
    tags: JSON.parse(row.tags_json),
    bio: row.bio,
    languages: row.languages,
    availability: JSON.parse(row.availability_json),
    verificationStatus: row.verification_status,
    topRated: Boolean(row.top_rated),
    ratingAverage: row.rating_average,
    reviewCount: row.review_count,
    applicationStatus: row.application_status
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sparkl-api' });
});

app.get('/api/cleaners', async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim().toLowerCase();
    const tag = (req.query.tag || 'All').toString();
    const sort = (req.query.sort || 'recommended').toString();

    const rows = await all(
      `SELECT * FROM cleaners WHERE is_active = 1 AND application_status = 'approved' AND verification_status = 'approved'`
    );

    let cleaners = rows.map(mapCleanerRow);

    if (tag !== 'All') {
      cleaners = tag === 'Top Rated'
        ? cleaners.filter((c) => c.topRated)
        : cleaners.filter((c) => c.tags.includes(tag));
    }

    if (search) {
      cleaners = cleaners.filter((c) =>
        c.fullName.toLowerCase().includes(search) ||
        c.neighbourhood.toLowerCase().includes(search) ||
        c.tags.some((t) => t.toLowerCase().includes(search))
      );
    }

    const sorters = {
      recommended: (a, b) => (b.topRated - a.topRated) || (b.ratingAverage - a.ratingAverage),
      price_asc: (a, b) => a.hourlyRate - b.hourlyRate,
      price_desc: (a, b) => b.hourlyRate - a.hourlyRate,
      rating_desc: (a, b) => b.ratingAverage - a.ratingAverage,
      reviews_desc: (a, b) => b.reviewCount - a.reviewCount
    };

    cleaners.sort(sorters[sort] || sorters.recommended);
    res.json({ data: cleaners });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load cleaners.' });
  }
});

app.get('/api/cleaners/:id', async (req, res) => {
  try {
    const row = await get(`SELECT * FROM cleaners WHERE id = ? AND is_active = 1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Cleaner not found.' });
    res.json({ data: mapCleanerRow(row) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load cleaner profile.' });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const body = req.body;
    const required = ['fullName', 'email', 'phone', 'neighbourhood', 'yearsExperience', 'services', 'hourlyRate', 'bio', 'availability'];
    const missing = required.find((field) => !body[field] || (Array.isArray(body[field]) && body[field].length === 0));
    if (missing) return res.status(400).json({ error: `Missing required field: ${missing}` });

    if (!body.agreements?.independentContractor || !body.agreements?.backgroundCheck || !body.agreements?.terms || !body.agreements?.noOffPlatform) {
      return res.status(400).json({ error: 'All agreement checkboxes must be accepted.' });
    }

    const result = await run(`INSERT INTO cleaner_applications (
      full_name, email, phone, neighbourhood, languages, years_experience, services_json,
      hourly_rate, bio, availability_json,
      agreement_independent_contractor, agreement_background_check, agreement_terms, agreement_no_off_platform
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      body.fullName,
      body.email,
      body.phone,
      body.neighbourhood,
      body.languages || '',
      body.yearsExperience,
      JSON.stringify(body.services),
      Number(body.hourlyRate),
      body.bio,
      JSON.stringify(body.availability),
      1, 1, 1, 1
    ]);

    res.status(201).json({ data: { id: result.id, status: 'pending_review' } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit application.' });
  }
});

app.post('/api/booking-requests', async (req, res) => {
  try {
    const body = req.body;
    const required = ['clientName', 'clientEmail', 'cleanerId', 'serviceType', 'preferredDate', 'preferredTime', 'homeSize'];
    const missing = required.find((field) => !body[field]);
    if (missing) return res.status(400).json({ error: `Missing required field: ${missing}` });

    const cleaner = await get('SELECT * FROM cleaners WHERE id = ? AND is_active = 1', [body.cleanerId]);
    if (!cleaner) return res.status(404).json({ error: 'Cleaner not found.' });

    const hourlyRate = cleaner.hourly_rate;
    const estimatedMin = hourlyRate * 2;
    const estimatedMax = hourlyRate * 3;

    const result = await run(`INSERT INTO booking_requests (
      client_name, client_email, cleaner_id, service_type, preferred_date, preferred_time,
      home_size, notes, booking_status, estimated_price_min, estimated_price_max
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)`, [
      body.clientName,
      body.clientEmail,
      body.cleanerId,
      body.serviceType,
      body.preferredDate,
      body.preferredTime,
      body.homeSize,
      body.notes || '',
      estimatedMin,
      estimatedMax
    ]);

    res.status(201).json({
      data: {
        id: result.id,
        status: 'requested',
        estimatedPriceMin: estimatedMin,
        estimatedPriceMax: estimatedMax
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create booking request.' });
  }
});

app.get('/api/admin/booking-requests', async (_req, res) => {
  try {
    const rows = await all(`
      SELECT br.*, c.full_name AS cleaner_name
      FROM booking_requests br
      JOIN cleaners c ON c.id = br.cleaner_id
      ORDER BY br.created_at DESC
    `);
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load booking requests.' });
  }
});

app.get('/api/admin/applications', async (_req, res) => {
  try {
    const rows = await all(`SELECT * FROM cleaner_applications ORDER BY created_at DESC`);
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load applications.' });
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Sparkl MVP running at http://localhost:${PORT}`);
  });
});
