const state = {
  cleaners: [],
  selectedCleaner: null,
  filters: {
    search: '',
    tag: 'All',
    sort: 'recommended'
  }
};

const pageEls = {
  home: document.getElementById('page-home'),
  profile: document.getElementById('page-profile'),
  dashboard: document.getElementById('page-dashboard'),
  onboard: document.getElementById('page-onboard')
};

function showPage(page) {
  Object.values(pageEls).forEach((el) => el.classList.remove('active'));
  pageEls[page].classList.add('active');
  document.querySelectorAll('.nav-link').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Something went wrong.');
  return payload;
}

function cardHtml(cleaner) {
  const badge = cleaner.topRated ? '⭐ Top Rated' : '✓ Verified';
  return `
    <article class="cleaner-card" data-id="${cleaner.id}">
      <div class="card-image" style="background:${cleaner.profileBg}">${cleaner.profileEmoji || '🧼'}</div>
      <div class="card-body">
        <div class="card-header">
          <strong>${cleaner.fullName}</strong>
          <span>★ ${cleaner.ratingAverage.toFixed(2)}</span>
        </div>
        <p class="card-sub">${cleaner.neighbourhood} · ${cleaner.city}</p>
        <div class="card-tags">
          ${cleaner.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
          <span class="tag">${badge}</span>
        </div>
        <div class="card-footer">
          <span><strong>$${cleaner.hourlyRate}</strong>/hr</span>
          <span>${cleaner.reviewCount} reviews</span>
        </div>
      </div>
    </article>`;
}

function renderGrid() {
  const grid = document.getElementById('cleanerGrid');
  if (!state.cleaners.length) {
    grid.innerHTML = '<div class="empty-state"><h3>No cleaners found</h3><p>Try another service tag or neighbourhood.</p></div>';
    return;
  }
  grid.innerHTML = state.cleaners.map(cardHtml).join('');
  grid.querySelectorAll('.cleaner-card').forEach((card) => {
    card.addEventListener('click', () => openProfile(Number(card.dataset.id)));
  });
}

async function loadCleaners() {
  const params = new URLSearchParams({
    search: state.filters.search,
    tag: state.filters.tag,
    sort: state.filters.sort
  });

  const grid = document.getElementById('cleanerGrid');
  grid.innerHTML = '<div class="empty-state">Loading cleaners…</div>';
  try {
    const response = await fetchJson(`/api/cleaners?${params.toString()}`);
    state.cleaners = response.data;
    renderGrid();
  } catch (error) {
    grid.innerHTML = `<div class="empty-state"><h3>Could not load cleaners</h3><p>${error.message}</p></div>`;
  }
}

async function openProfile(cleanerId) {
  try {
    const response = await fetchJson(`/api/cleaners/${cleanerId}`);
    state.selectedCleaner = response.data;
    const cleaner = state.selectedCleaner;

    document.getElementById('profAvatar').style.background = cleaner.profileBg;
    document.getElementById('profAvatar').textContent = cleaner.profileEmoji;
    document.getElementById('profName').textContent = cleaner.fullName;
    document.getElementById('profMeta').textContent = `${cleaner.neighbourhood}, ${cleaner.city} · ★ ${cleaner.ratingAverage.toFixed(2)} (${cleaner.reviewCount} reviews)`;
    document.getElementById('profPriceBig').innerHTML = `<strong>$${cleaner.hourlyRate}</strong>/hr starting rate`;
    document.getElementById('profBio').textContent = cleaner.bio;
    document.getElementById('profServices').innerHTML = cleaner.services
      .map((service) => `<div class="service-row"><span>${service.name}</span><strong>${service.price}</strong></div>`)
      .join('');

    showPage('profile');
  } catch (error) {
    alert(error.message);
  }
}

function setMessage(id, text, type = 'success') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.remove('success', 'error');
  el.classList.add(type);
}

function clearMessage(id) {
  const el = document.getElementById(id);
  el.textContent = '';
  el.classList.remove('success', 'error');
}

function openBookingModal() {
  if (!state.selectedCleaner) return;
  clearMessage('bookingMessage');
  document.getElementById('bookingModal').classList.add('open');
}

function closeBookingModal() {
  document.getElementById('bookingModal').classList.remove('open');
}

async function submitBookingRequest(event) {
  event.preventDefault();
  if (!state.selectedCleaner) return;
  clearMessage('bookingMessage');

  const formData = new FormData(event.currentTarget);
  const payload = {
    clientName: formData.get('clientName')?.toString().trim(),
    clientEmail: formData.get('clientEmail')?.toString().trim(),
    cleanerId: state.selectedCleaner.id,
    serviceType: formData.get('serviceType'),
    preferredDate: formData.get('preferredDate'),
    preferredTime: formData.get('preferredTime'),
    homeSize: formData.get('homeSize'),
    notes: formData.get('notes')?.toString().trim()
  };

  try {
    const response = await fetchJson('/api/booking-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setMessage('bookingMessage', `Request submitted. Estimate: $${response.data.estimatedPriceMin}-$${response.data.estimatedPriceMax}.`, 'success');
    event.currentTarget.reset();
    await loadBookingDashboard();
  } catch (error) {
    setMessage('bookingMessage', error.message, 'error');
  }
}

async function submitApplication(event) {
  event.preventDefault();
  clearMessage('applicationMessage');

  const formData = new FormData(event.currentTarget);
  const services = (formData.get('services') || '').toString().split(',').map((s) => s.trim()).filter(Boolean);
  const availability = (formData.get('availability') || '').toString().split(',').map((s) => s.trim()).filter(Boolean);

  const payload = {
    fullName: formData.get('fullName')?.toString().trim(),
    email: formData.get('email')?.toString().trim(),
    phone: formData.get('phone')?.toString().trim(),
    neighbourhood: formData.get('neighbourhood')?.toString().trim(),
    languages: formData.get('languages')?.toString().trim(),
    yearsExperience: formData.get('yearsExperience'),
    services,
    hourlyRate: Number(formData.get('hourlyRate')),
    bio: formData.get('bio')?.toString().trim(),
    availability,
    agreements: {
      independentContractor: formData.get('independentContractor') === 'on',
      backgroundCheck: formData.get('backgroundCheck') === 'on',
      terms: formData.get('terms') === 'on',
      noOffPlatform: formData.get('noOffPlatform') === 'on'
    }
  };

  if (!payload.services.length || !payload.availability.length) {
    setMessage('applicationMessage', 'Please include at least one service and one availability day.', 'error');
    return;
  }

  try {
    await fetchJson('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setMessage('applicationMessage', 'Application submitted. Status: pending review.', 'success');
    event.currentTarget.reset();
  } catch (error) {
    setMessage('applicationMessage', error.message, 'error');
  }
}

async function loadBookingDashboard() {
  const container = document.getElementById('bookingListBody');
  container.innerHTML = '<div class="booking-row">Loading requests…</div>';
  try {
    const response = await fetchJson('/api/admin/booking-requests');
    if (!response.data.length) {
      container.innerHTML = '<div class="booking-row">No booking requests yet.</div>';
      return;
    }
    container.innerHTML = response.data.slice(0, 8).map((booking) => `
      <div class="booking-row">
        <div>
          <strong>${booking.client_name}</strong>
          <div class="muted">${booking.cleaner_name} · ${booking.service_type} · ${booking.preferred_date} ${booking.preferred_time}</div>
        </div>
        <span>${booking.booking_status}</span>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<div class="booking-row">${error.message}</div>`;
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach((el) => el.classList.remove('active'));
      pill.classList.add('active');
      state.filters.tag = pill.dataset.tag;
      loadCleaners();
    });
  });

  document.getElementById('searchBtn').addEventListener('click', () => {
    state.filters.search = document.getElementById('searchInput').value.trim();
    loadCleaners();
  });

  document.getElementById('searchInput').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    state.filters.search = event.target.value.trim();
    loadCleaners();
  });

  document.getElementById('sortSelect').addEventListener('change', (event) => {
    state.filters.sort = event.target.value;
    loadCleaners();
  });

  document.getElementById('backToBrowse').addEventListener('click', () => showPage('home'));
  document.getElementById('openBookingBtn').addEventListener('click', openBookingModal);
  document.getElementById('closeBookingBtn').addEventListener('click', closeBookingModal);
  document.getElementById('bookingModal').addEventListener('click', (event) => {
    if (event.target.id === 'bookingModal') closeBookingModal();
  });

  document.getElementById('bookingForm').addEventListener('submit', submitBookingRequest);
  document.getElementById('applicationForm').addEventListener('submit', submitApplication);
  document.getElementById('refreshDashboard').addEventListener('click', loadBookingDashboard);
}

bindEvents();
loadCleaners();
loadBookingDashboard();
