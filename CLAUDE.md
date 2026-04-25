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
├── backend/       ← Express + Supabase REST API (A01–A04 team)
├── database/      ← Supabase schema and migrations
└── docs/          ← Project-wide documentation
```

## Tech Stack
| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | React 19, Vite 8, react-router-dom v7   |
| Backend    | Node.js, Express, Supabase (PostgreSQL) |
| Auth       | JWT (access token) + HTTP-only refresh cookie |
| Containers | Docker (managed by BDS-8B data plane)   |

## Frontend Architecture
```
src/
├── api/
│   ├── auth.js        Real API: POST /login, /register, /logout (demo fallback on network error)
│   ├── projects.js    Real API: GET/POST /project (mock data in demo mode)
│   ├── instances.js   MOCK (localStorage): CRUD + scaleInstance() for Phase 2
│   ├── billing.js     Computed billing: containerCost(), billingByProject(), totalCost()
│   └── mock-seed.js   Demo mode: seed data, DEMO_TOKEN, isDemoMode(), enableDemoMode()
├── context/
│   └── AuthContext.jsx  JWT token + user + demoMode flag stored in localStorage
├── components/
│   ├── Layout.jsx       Sidebar + <Outlet /> + yellow demo banner when offline
│   ├── Sidebar.jsx      Navigation (Dashboard, Projects, Containers, Billing) + demo tag
│   ├── Modal.jsx        Generic dialog (Escape to close)
│   └── ProtectedRoute.jsx  Redirects to /login if unauthenticated
└── pages/
    ├── Login.jsx        POST /login; auto-demo mode on network failure
    ├── Register.jsx     POST /register with password strength validation
    ├── Dashboard.jsx    5 stat cards (projects, containers, CPU, memory, cost) + resource trends
    ├── Projects.jsx     List + create projects + role-based member management
    ├── Containers.jsx   Deploy + scale replicas + delete; ?project= filter
    └── Billing.jsx      Per-project and per-container cost breakdown (Phase 2)
```

## Demo Mode (backend offline)
When the backend is unreachable, the frontend enters Demo Mode automatically on login:
- A yellow banner appears at the top of every page
- A "demo" tag shows next to the user avatar in the sidebar
- Mock projects (3) and containers (6) are pre-seeded into localStorage
- All interactions (create project, deploy, scale, delete) work locally
- To exit: click Logout — demo data is cleared

## Running Locally
```bash
# Start backend (requires .env with Supabase creds + JWT_SECRET)
cd backend && npm install && node server.js

# Start frontend (works with or without backend — see demo mode above)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

## Environment Variables
### Backend (`backend/.env`)
```
SUPABASE_URL=...
SUPABASE_KEY=...
JWT_SECRET=...          # or JWT_ACCESS_SECRET
JWT_ACCESS_SECRET=...
PORT=5000
```
### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000   # default; only set if backend moves
```

## Key API Endpoints (A01–A04 backend)
| Method | Path                           | Auth | Description               |
|--------|-------------------------------|------|---------------------------|
| POST   | /register                     | —    | Create account            |
| POST   | /login                        | —    | Get access + refresh JWT  |
| POST   | /logout                       | —    | Revoke refresh token      |
| GET    | /project                      | JWT  | List user projects        |
| POST   | /project                      | JWT  | Create a project          |
| GET    | /project/:id/members          | JWT  | List project members      |
| POST   | /project/:id/members          | JWT  | Add/update member         |
| DELETE | /project/:id/members/:userId  | JWT  | Remove member             |

## Planned Endpoints (BDS-8B data plane — mock in frontend)
| Method | Path                  | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | /instance             | Launch a container             |
| DELETE | /instance/:id         | Delete a container             |
| GET    | /instances            | List all containers            |
| PUT    | /instance/:id/scale   | Scale replicas (Phase 2)       |
| GET    | /usage/:project_id    | Resource usage (Phase 2)       |
| GET    | /billing/:project_id  | Billing breakdown (Phase 2)    |
| GET    | /metrics/:project_id  | Time-series metrics (Phase 2)  |

When data-plane endpoints are live, replace function bodies in `frontend/src/api/instances.js`.
When billing endpoints are live, replace functions in `frontend/src/api/billing.js`.

## Documentation Files
| File | Purpose |
|------|---------|
| `frontend/ARCHITECTURE.md` | Full architecture diagram, component tree, data flows |
| `PROJECT_API.md` | Complete API reference for all endpoints |
| `NIST_MAPPING.md` | Maps all 5 NIST characteristics to frontend + backend implementations |
| `docs/A06/STARTER.md` | Team A06 implementation status and decision log |

## Code Style
- Functional React components with hooks only
- CSS class names in `App.css` — no CSS-in-JS, no Tailwind
- API calls centralised in `src/api/` — pages never `fetch()` directly
- No TypeScript (keep it accessible for the team)
- Prefer clarity over cleverness
- Billing formula: `Cost = (runtime_minutes × 2) + (memory_MB × 0.01)` per replica

## Branch Convention
```
feat/<team>/<short-description>    e.g.  feat/A06/frontend-dashboard
fix/<team>/<short-description>
```
