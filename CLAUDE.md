# CampusCloud — Claude Code Guide

## Project Overview
CampusCloud is a student-built private cloud platform simulating AWS/Azure on a single Docker host.
It implements the five NIST Cloud Characteristics: On-Demand Self-Service, Broad Network Access,
Resource Pooling, Rapid Elasticity, and Measured Service.

**Our team (A06) owns:** API Gateway + Frontend Dashboard (BDS-8A, A05–A08).

## Monorepo Structure
```
campuscloud/
├── frontend/      ← React + Vite dashboard (our primary responsibility)
├── backend/       ← Express + PostgreSQL REST API (A01–A04 team)
├── api-gateway/   ← Express reverse proxy / load balancer
├── database/      ← Canonical schema + migrations (source of truth)
└── docs/          ← Project-wide documentation
```

## Tech Stack
| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Frontend    | React 19, Vite 8, react-router-dom v7       |
| Backend     | Node.js, Express, PostgreSQL (via pg pool)  |
| API Gateway | Express + axios, rate-limiting, retry logic |
| Auth        | JWT (15 min access token) + HttpOnly refresh cookie (7 days) |
| Containers  | Docker (managed by BDS-8B data plane)       |

## Frontend Architecture
```
src/
├── api/
│   ├── http.js        apiFetch() — auto-refreshes expired tokens, fires cc:sessionexpired on failure
│   ├── auth.js        POST /login, /register, /logout — demo fallback on network error
│   ├── projects.js    GET/POST /project via apiFetch — mock data in demo mode
│   ├── instances.js   MOCK (localStorage): getInstances, createInstance, deleteInstance, scaleInstance
│   ├── billing.js     Computed billing: containerCost(), billingByProject(), totalCost()
│   └── mock-seed.js   Demo mode: seed data, DEMO_TOKEN, isDemoMode(), enableDemoMode()
├── context/
│   └── AuthContext.jsx  token + user + demoMode; listens for cc:sessionexpired to auto-logout
├── components/
│   ├── Layout.jsx        Sidebar + <Outlet /> + yellow demo banner when offline
│   ├── Sidebar.jsx       Navigation (Dashboard, Projects, Containers, Billing) + demo tag
│   ├── Modal.jsx         Generic dialog (Escape to close)
│   ├── MembersModal.jsx  Project member management (owner only)
│   └── ProtectedRoute.jsx  Redirects to /login if no token
└── pages/
    ├── Login.jsx      POST /login; auto-demo mode on TypeError (backend unreachable)
    ├── Register.jsx   POST /register with live password strength validation
    ├── Dashboard.jsx  5 stat cards + recent tables + resource consumption trends
    ├── Projects.jsx   List + create projects + member management
    ├── Containers.jsx Deploy + scale replicas (1–5) + delete; ?project= filter
    └── Billing.jsx    Per-project and per-container cost breakdown
```

## Demo Mode (backend offline)
When the backend is unreachable (`TypeError` on login), the app enters **Demo Mode** automatically:
- Yellow banner on every page; "demo" tag in sidebar
- 3 mock projects and 6 containers pre-seeded into localStorage
- All CRUD (create project, deploy, scale, delete) works locally
- Logout clears all demo data

## Running Locally
```bash
# Backend (requires .env — see variables below)
cd backend && npm install && npm run dev
# → http://localhost:5000
# npm run dev = npm run setup (creates DB + runs schema.sql) + nodemon server.js

# API Gateway (optional — frontend calls backend directly by default)
cd api-gateway && npm install && node src/server.js
# → http://localhost:3000

# Frontend (works with or without backend — demo mode covers offline use)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

## Environment Variables

### Backend (`backend/.env`)
```
# At least one of these is required — server will not start without it
JWT_ACCESS_SECRET=your-secret-here
# JWT_SECRET=your-secret-here   ← fallback alias

DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
DB_NAME=campuscloud
DB_SSL=false                    # set true for Supabase/Neon/RDS

PORT=5000
NODE_ENV=development

# CORS — comma-separated list of allowed frontend origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000   # omit to use default
```

### API Gateway (`api-gateway/.env`)
```
ALLOWED_ORIGINS=http://localhost:5173
```

## Database
`backend/schema.sql` is the file actually run by `npm run dev` (via `scripts/setup_db.js`).
`database/schema.sql` is the canonical reference — keep both in sync.
Migrations live in `database/migrations/` and are applied in numbered order.

| Migration | Contents |
|-----------|----------|
| `001_init.sql` | users, refresh_tokens, projects (with description + status), indexes |
| `002_project_members.sql` | project_members table, backfill owner rows |
| `003_quotas_containers.sql` | project_quotas, containers (UUID foreign keys) |

## Key API Endpoints (A01–A04 backend — live)
| Method | Path                          | Auth | Description                        |
|--------|------------------------------|------|------------------------------------|
| POST   | /register                    | —    | Create account                     |
| POST   | /login                       | —    | Get access token + set refresh cookie |
| POST   | /refresh                     | cookie | Silent access token renewal      |
| POST   | /logout                      | cookie | Delete refresh token, clear cookie |
| GET    | /project                     | JWT  | List projects the caller is a member of |
| POST   | /project                     | JWT  | Create project (caller becomes owner) |
| GET    | /project/:id                 | JWT  | Get single project (viewer+)       |
| PUT    | /project/:id                 | JWT  | Update name/description (editor+)  |
| DELETE | /project/:id                 | JWT  | Soft-delete project (owner only)   |
| GET    | /project/:id/members         | JWT  | List members (viewer+)             |
| POST   | /project/:id/members         | JWT  | Add/update member (owner only)     |
| DELETE | /project/:id/members/:userId | JWT  | Remove member (owner only)         |

## Planned Endpoints (BDS-8B data plane — mocked in frontend)
| Method | Path                  | Description                      |
|--------|-----------------------|----------------------------------|
| POST   | /instance             | Launch a container               |
| DELETE | /instance/:id         | Delete a container               |
| GET    | /instances            | List all containers              |
| PUT    | /instance/:id/scale   | Scale replicas (Phase 2)         |
| GET    | /usage/:project_id    | Resource usage (Phase 2)         |
| GET    | /billing/:project_id  | Billing breakdown (Phase 2)      |
| GET    | /metrics/:project_id  | Time-series metrics (Phase 2)    |

Swap points: replace function bodies in `frontend/src/api/instances.js` and `api/billing.js`.

## Token Lifecycle
1. `POST /login` or `POST /register` → returns `accessToken` (15 min) + sets `refreshToken` cookie (7 days)
2. Every protected API call goes through `apiFetch()` in `api/http.js`
3. On `401 Token expired`, `apiFetch` calls `POST /refresh` silently and retries
4. On refresh failure, fires `cc:sessionexpired` → `AuthContext` calls `logout()`
5. `POST /logout` deletes the refresh token from DB and clears the cookie

## Documentation Files
| File | Purpose |
|------|---------|
| `frontend/ARCHITECTURE.md` | Full architecture diagram, component tree, data flows |
| `PROJECT_API.md` | Complete API reference including billing and scaling endpoints |
| `NIST_MAPPING.md` | Maps all 5 NIST characteristics to frontend + backend implementations |
| `docs/A06/STARTER.md` | Team A06 implementation status and decision log |

## Code Style
- Functional React components with hooks only
- CSS class names in `App.css` — no CSS-in-JS, no Tailwind
- All API calls go through `src/api/` — pages never call `fetch()` directly
- All authenticated calls use `apiFetch()` from `api/http.js`, not raw `fetch()`
- No TypeScript (keep it accessible for the team)
- Prefer clarity over cleverness
- Billing formula: `Cost = (runtime_minutes × 2) + (memory_MB × 0.01)` per replica

## Branch Convention
```
feat/<team>/<short-description>    e.g.  feat/A06/frontend-dashboard
fix/<team>/<short-description>
```
