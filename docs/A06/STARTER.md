# Team A06 — API Gateway + Frontend Dashboard

**Section:** BDS-8A (Control Plane) · **Branch:** `feat/A06/frontend-dashboard`

---

## Status

### Phase 1 — Core Cloud Setup ✅ Complete

| Feature | Status | File |
|---------|:------:|------|
| User login (POST /login) | ✅ | `pages/Login.jsx` + `api/auth.js` |
| User registration (POST /register) | ✅ | `pages/Register.jsx` |
| Project creation (POST /project) | ✅ | `pages/Projects.jsx` + `api/projects.js` |
| Project listing (GET /project) | ✅ | `pages/Projects.jsx` |
| Role-based access (owner/editor/viewer) | ✅ | `pages/Projects.jsx`, `MembersModal.jsx` |
| Container deployment (mock) | ✅ | `pages/Containers.jsx` + `api/instances.js` |
| Container deletion (mock) | ✅ | `pages/Containers.jsx` |
| View running instances | ✅ | `pages/Containers.jsx`, `pages/Dashboard.jsx` |
| CPU + memory stats | ✅ | `pages/Dashboard.jsx` + `api/instances.js getStats()` |
| Demo mode (offline fallback) | ✅ | `api/auth.js`, `api/mock-seed.js` |

### Phase 2 — Advanced Dashboard ✅ Complete

| Feature | Status | File |
|---------|:------:|------|
| Billing calculation (`runtime × 2 + memory × 0.01`) | ✅ | `api/billing.js` |
| Accrued cost stat card on Dashboard | ✅ | `pages/Dashboard.jsx` |
| Per-project resource consumption trends | ✅ | `pages/Dashboard.jsx` |
| Full billing breakdown page | ✅ | `pages/Billing.jsx` |
| Container replica scaling (+/- controls) | ✅ | `pages/Containers.jsx` + `api/instances.js scaleInstance()` |
| Billing nav item in sidebar | ✅ | `components/Sidebar.jsx` |

---

## Architecture

- **Frontend:** React 19 + Vite 8 at `http://localhost:5173`
- **Backend:** Node.js + Express at `http://localhost:5000` (A01–A04)
- **Auth:** JWT via `Authorization: Bearer` header; token stored in `localStorage`
- **State:** React Context (`AuthContext`) for auth; `useState` per page for lists
- **Mock store:** `localStorage["campuscloud_instances"]` for containers until BDS-8B is live

## Demo Mode

If the backend is unreachable at login time, the app automatically enters Demo Mode:
- Auth falls back to a local demo user (any email + password)
- 3 mock projects and 6 mock containers are pre-seeded
- Full UI is functional; data changes persist only in `localStorage`
- Yellow banner is shown on all protected pages

## Swap Points (backend integration)

| Module | Function | Replace with |
|--------|----------|-------------|
| `api/instances.js` | All functions | Real fetch() to `/instance`, `/instances` |
| `api/billing.js` | All functions | `GET /billing/:id`, `GET /usage/:id` |

## Environment Variables

Frontend (`frontend/.env`):
```
VITE_API_URL=http://localhost:5000
```

Backend (`backend/.env`):
```
SUPABASE_URL=...
SUPABASE_KEY=...
JWT_ACCESS_SECRET=...
PORT=5000
```

## Key Decisions

- **No TypeScript** — keeps codebase accessible for all team members
- **localStorage mock for instances** — unblocks frontend development while BDS-8B builds data plane
- **Demo mode** — allows demo/presentation without backend dependency
- **Billing computed locally** — enables Phase 2 dashboard without waiting for A09–A11 billing engine
- **Replica cap at 5** — reasonable limit for a single Docker host (matches NIST Rapid Elasticity requirement)
