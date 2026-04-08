# Sparkl MVP

Sparkl is a curated, trust-first marketplace for independent cleaners in Hamilton, Ontario.

## 1) Current project audit (before this refactor)

Originally the repo was a single `index.html` prototype containing:
- all styles, markup, and JS in one file
- hardcoded cleaner profile/listing data
- static booking/onboarding flows with no persistence

This made iteration fast but blocked true MVP behavior (no backend, no stored requests, no admin review queue).

## 2) Recommended stack for this MVP (lean + production-minded)

### Chosen stack in this repo now
- **Frontend:** Vanilla HTML/CSS/JS (keeps your current design direction intact)
- **Backend:** Node.js + Express
- **Database:** SQLite (single-file DB for fast MVP launch and easy migration later)

### Why this is the best fit right now
- Minimal complexity; no framework migration required yet
- Preserves your existing UI direction and avoids “generic SaaS template” drift
- Gives real API + persistence immediately
- Easy next-step path to auth, emails, and payments later

## 3) Implementation plan

### Phase 1 (implemented foundation)
- Refactor one-file prototype into maintainable structure
- Add real API + database for cleaners, booking requests, cleaner applications
- Wire browse/profile/onboarding/booking flow to backend
- Add admin-review-ready endpoints

### Phase 2 (next)
- Cleaner/client auth
- Cleaner request inbox + accept/decline
- Client request status timeline
- Email notifications (submitted/accepted/declined)

### Phase 3 (next)
- Payments/deposit flow
- Verified reviews
- Rebook mechanics
- Finalized legal/trust content and moderation tools

## 4) New project structure

```txt
.
├─ server.js
├─ db.js
├─ sparkl.db                 # created automatically on first run
├─ public/
│  ├─ index.html
│  ├─ css/styles.css
│  ├─ js/app.js
│  └─ legal/
│     ├─ terms.html
│     ├─ privacy.html
│     ├─ trust-safety.html
│     └─ contractor-terms.html
└─ README.md
```

## 5) API endpoints (Phase 1)

- `GET /api/health`
- `GET /api/cleaners?search=&tag=&sort=`
- `GET /api/cleaners/:id`
- `POST /api/applications`
- `POST /api/booking-requests`
- `GET /api/admin/booking-requests`
- `GET /api/admin/applications`

## 6) Local development

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## 7) How to test Phase 1 locally

1. Browse/search/filter cleaners on homepage.
2. Open a cleaner profile and submit booking request.
3. Go to **My Bookings** and click Refresh to see saved request rows.
4. Submit cleaner onboarding application in **Apply as Cleaner**.
5. (Optional) inspect API directly:
   - `curl http://localhost:3000/api/admin/booking-requests`
   - `curl http://localhost:3000/api/admin/applications`

## Product rule alignment

- Clients choose cleaners directly (no manual matching).
- Booking flow is request-to-book (not instant booking).
- Cleaners are modeled as independent contractors.
- Public listings are filtered to approved/verified cleaners.
