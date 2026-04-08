const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'sparkl.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS cleaners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    profile_emoji TEXT,
    profile_bg TEXT,
    neighbourhood TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Hamilton',
    hourly_rate INTEGER NOT NULL,
    services_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    bio TEXT NOT NULL,
    languages TEXT,
    availability_json TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'approved',
    top_rated INTEGER NOT NULL DEFAULT 0,
    rating_average REAL NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    application_status TEXT NOT NULL DEFAULT 'approved',
    is_active INTEGER NOT NULL DEFAULT 1
  )`);

  await run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS cleaner_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    neighbourhood TEXT NOT NULL,
    languages TEXT,
    years_experience TEXT NOT NULL,
    services_json TEXT NOT NULL,
    hourly_rate INTEGER NOT NULL,
    bio TEXT NOT NULL,
    availability_json TEXT NOT NULL,
    agreement_independent_contractor INTEGER NOT NULL,
    agreement_background_check INTEGER NOT NULL,
    agreement_terms INTEGER NOT NULL,
    agreement_no_off_platform INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS booking_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    cleaner_id INTEGER NOT NULL,
    service_type TEXT NOT NULL,
    preferred_date TEXT NOT NULL,
    preferred_time TEXT NOT NULL,
    home_size TEXT NOT NULL,
    notes TEXT,
    booking_status TEXT NOT NULL DEFAULT 'requested',
    estimated_price_min INTEGER NOT NULL,
    estimated_price_max INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cleaner_id) REFERENCES cleaners(id)
  )`);

  const cleanerCount = await get('SELECT COUNT(*) as count FROM cleaners');
  if (cleanerCount.count === 0) {
    const seedCleaners = [
      {
        full_name: 'Nadine Browne', profile_emoji: '🧹', profile_bg: '#E8F2EC', neighbourhood: 'Westdale',
        hourly_rate: 32, tags: ['Regular', 'Deep Clean'],
        services: [{ name: 'Regular clean (2–3 hrs)', price: '$64–$96' }, { name: 'Deep clean (4–5 hrs)', price: '$128–$160' }, { name: 'Move in/out', price: '$180–$240' }],
        bio: "Born in Trinidad, I've been cleaning homes in Hamilton for 8 years. I take pride in leaving every home spotless and I love building long-term relationships with my clients.",
        languages: 'English, French Creole', availability: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], top_rated: 1, rating_average: 4.97, review_count: 63
      },
      {
        full_name: 'Patrice Joseph', profile_emoji: '✨', profile_bg: '#FBF3E4', neighbourhood: 'Durand',
        hourly_rate: 35, tags: ['Deep Clean', 'Regular', 'Post Reno'],
        services: [{ name: 'Regular clean', price: '$70–$105' }, { name: 'Deep clean', price: '$140–$175' }, { name: 'Post-renovation', price: '$200–$300' }],
        bio: "I'm detail-oriented with a specialty in deep cleaning and post-renovation projects. I bring my own eco-friendly products.",
        languages: 'English, French', availability: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat'], top_rated: 1, rating_average: 4.91, review_count: 44
      },
      {
        full_name: 'Claudette Williams', profile_emoji: '🏡', profile_bg: '#F5EAE7', neighbourhood: 'Kirkendall',
        hourly_rate: 28, tags: ['Regular', 'Move In/Out'],
        services: [{ name: 'Regular clean', price: '$56–$84' }, { name: 'Move in/out', price: '$140–$180' }, { name: 'Laundry add-on', price: '+$20' }],
        bio: 'Family home specialist. I bring consistency, warmth, and care to every home.',
        languages: 'English, Patois', availability: ['Mon', 'Wed', 'Fri'], top_rated: 0, rating_average: 4.88, review_count: 31
      }
    ];

    for (const cleaner of seedCleaners) {
      await run(`INSERT INTO cleaners (
        full_name, profile_emoji, profile_bg, neighbourhood, city, hourly_rate,
        services_json, tags_json, bio, languages, availability_json,
        verification_status, top_rated, rating_average, review_count, application_status, is_active
      ) VALUES (?, ?, ?, ?, 'Hamilton', ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, 'approved', 1)`, [
        cleaner.full_name,
        cleaner.profile_emoji,
        cleaner.profile_bg,
        cleaner.neighbourhood,
        cleaner.hourly_rate,
        JSON.stringify(cleaner.services),
        JSON.stringify(cleaner.tags),
        cleaner.bio,
        cleaner.languages,
        JSON.stringify(cleaner.availability),
        cleaner.top_rated,
        cleaner.rating_average,
        cleaner.review_count
      ]);
    }
  }
}

module.exports = { db, run, all, get, initDb };
