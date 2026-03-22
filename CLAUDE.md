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
| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | React 19, Vite 8, react-router-dom v7   |
| Backend   | Node.js, Express, Supabase (PostgreSQL) |
| Auth      | JWT (access token) + HTTP-only refresh cookie |
| Containers | Docker (managed by BDS-8B data plane)  |

## Frontend Architecture
```
src/
├── api/
│   ├── auth.js        Real API: POST /login, /register, /logout
│   ├── projects.js    Real API: GET/POST /project
│   └── instances.js   MOCK (localStorage) — swap for real /instance API
├── context/
│   └── AuthContext.jsx  JWT token + user stored in localStorage
├── components/
│   ├── Layout.jsx       Sidebar + <Outlet /> shell
│   ├── Sidebar.jsx      Navigation sidebar
│   ├── Modal.jsx        Generic dialog (Escape to close)
│   └── ProtectedRoute.jsx  Redirects to /login if unauthenticated
└── pages/
    ├── Login.jsx        POST /login
    ├── Register.jsx     POST /register
    ├── Dashboard.jsx    Overview: stats, recent projects, recent containers
    ├── Projects.jsx     List + create projects
    └── Containers.jsx   Deploy + delete containers; ?project= filter param
```

## Running Locally
```bash
# Start backend (requires .env with Supabase creds + JWT_SECRET)
cd backend && npm install && node server.js

# Start frontend
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

## Key API Endpoints (implemented by A01–A04 backend)
| Method | Path         | Auth | Description              |
|--------|-------------|------|--------------------------|
| POST   | /register   | —    | Create account           |
| POST   | /login      | —    | Get access + refresh JWT |
| POST   | /logout     | —    | Revoke refresh token     |
| GET    | /project    | JWT  | List user projects       |
| POST   | /project    | JWT  | Create a project         |

## Planned Endpoints (BDS-8B data plane — not yet live)
| Method | Path                | Description               |
|--------|---------------------|---------------------------|
| POST   | /instance           | Launch a container        |
| DELETE | /instance/:id       | Delete a container        |
| GET    | /instances          | List all containers       |
| GET    | /instances/:proj_id | List containers by project|

When these are ready, replace the bodies of the functions in
`frontend/src/api/instances.js` with real `fetch()` calls.

## Code Style
- Functional React components with hooks only
- CSS class names in `App.css` — no CSS-in-JS, no Tailwind
- API calls centralised in `src/api/` — pages never `fetch()` directly
- No TypeScript (keep it accessible for the team)
- Prefer clarity over cleverness

## Branch Convention
```
feat/<team>/<short-description>    e.g.  feat/A06/frontend-dashboard
fix/<team>/<short-description>
```
