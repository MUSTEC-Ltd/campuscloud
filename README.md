<div align="center">

# ☁️ CampusCloud

**A student-built private cloud platform — simulating AWS / Azure on a single machine using Docker.**

[![React](https://img.shields.io/badge/Frontend-React_19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Backend-Node.js_Express-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![Docker](https://img.shields.io/badge/Runtime-Docker-2496ed?logo=docker&logoColor=white)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What is CampusCloud?

CampusCloud is a fully functional mini private cloud platform built by students across two sections — **BDS-8A** (Control Plane) and **BDS-8B** (Data Plane). The goal is to design and implement a simplified version of commercial cloud providers such as Amazon Web Services or Microsoft Azure, deployed on a single host machine using Docker.

The platform demonstrates all five **NIST SP 800-145 essential cloud characteristics:**

| # | Characteristic | How it's demonstrated |
|---|---------------|----------------------|
| 1 | **On-Demand Self-Service** | Users register, create projects, and deploy / delete containers entirely through the dashboard — no admin involvement |
| 2 | **Broad Network Access** | A React web dashboard accessible from any browser over the campus network; standard JWT over HTTP |
| 3 | **Resource Pooling** | Multiple users share the same Docker host; each user's projects and containers are isolated by JWT-scoped API calls |
| 4 | **Rapid Elasticity** | Containers can be launched and torn down in seconds from the dashboard; Phase 2 adds dynamic scaling |
| 5 | **Measured Service** | Dashboard stat cards show per-user CPU %, memory MB, and container counts in real time |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER  (Browser)                          │
│              React SPA  ·  http://localhost:5173                │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP / REST  (Bearer JWT)
┌──────────────────────────▼──────────────────────────────────────┐
│                 CONTROL PLANE  —  BDS-8A                        │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │         Express Backend  (Node.js · :5000)               │   │
│   │  POST /register  ·  POST /login  ·  POST /logout         │   │
│   │  GET /project    ·  POST /project                        │   │
│   └──────────────────────┬──────────────────────────────────┘   │
│                          │  Supabase JS SDK                     │
│   ┌──────────────────────▼──────────────────────────────────┐   │
│   │  Supabase (PostgreSQL)                                   │   │
│   │  users  ·  refresh_tokens  ·  projects                  │   │
│   └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Docker SDK / REST
┌──────────────────────────▼──────────────────────────────────────┐
│                   DATA PLANE  —  BDS-8B                         │
│                                                                 │
│   Compute (B01–B03)      Network (B04–B06)   Monitoring (B07–B09)│
│   POST /instance          per-project         GET /metrics       │
│   DELETE /instance/:id    Docker networks     /:project_id       │
│   GET /instances                                                 │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │              Docker Host  (single machine)                │   │
│   │  [container-1]  [container-2]  ···  [container-N]        │   │
│   └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
campuscloud/
├── frontend/          React + Vite dashboard  (Team A06 — our work)
│   ├── src/
│   │   ├── api/       Centralised API modules (auth, projects, instances)
│   │   ├── components/  Layout, Sidebar, Modal, ProtectedRoute
│   │   ├── context/   AuthContext (JWT state)
│   │   └── pages/     Login, Register, Dashboard, Projects, Containers
│   ├── README.md      Frontend developer guide
│   ├── API_DOCS.md    Frontend API integration reference
│   ├── ARCHITECTURE.md  Frontend component & data-flow diagrams
│   └── NIST_COMPLIANCE.md  NIST mapping for the frontend
│
├── backend/           Express REST API  (Teams A01–A04)
├── database/          Supabase schema, migrations
├── docs/              Project-wide design notes
└── CLAUDE.md          AI coding guide for the repo
```

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18.x or higher |
| npm | 9.x or higher |
| Docker | 20.x or higher (for data plane) |

### 1 — Clone

```bash
git clone https://github.com/MUSTEC-Ltd/campuscloud.git
cd campuscloud
```

### 2 — Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_or_service_key
JWT_SECRET=a_long_random_secret_string
JWT_ACCESS_SECRET=a_long_random_secret_string
PORT=5000
```

```bash
node server.js
# → API running at http://localhost:5000
```

### 3 — Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` (optional — defaults to `localhost:5000`):

```env
VITE_API_URL=http://localhost:5000
```

```bash
npm run dev
# → Dashboard at http://localhost:5173
```

> **No backend? No problem.**
> The frontend runs with a localStorage mock for containers, so you can explore the UI without the backend running. Only login, registration, and project creation require a live backend.

---

## Features

### Phase 1 — Core Cloud ✅

| Feature | Status | Where |
|---------|--------|-------|
| User registration | ✅ Live | `POST /register` · `pages/Register.jsx` |
| User login (JWT) | ✅ Live | `POST /login` · `pages/Login.jsx` |
| Create projects | ✅ Live | `POST /project` · `pages/Projects.jsx` |
| Deploy containers | ✅ (mock) | `api/instances.js` · `pages/Containers.jsx` |
| Delete containers | ✅ (mock) | `api/instances.js` · `pages/Containers.jsx` |
| View running instances | ✅ Live | `pages/Containers.jsx` |
| Resource usage dashboard | ✅ Live | `pages/Dashboard.jsx` |

> **Mock** = localStorage simulation. Swap `src/api/instances.js` with real `fetch()` calls when BDS-8B data plane goes live. See `frontend/README.md` for the exact replacement pattern.

### Phase 2 — Advanced Cloud *(In Progress)*

- [ ] Dynamic container scaling per project
- [ ] Real-time billing (`Cost = runtime × 2 + memory × 0.01`)
- [ ] Billing dashboard with usage trends
- [ ] Full control plane ↔ data plane integration
- [ ] Enhanced security & token validation across services

---

## Team Structure

### BDS-8A — Control Plane

| Team | Responsibility |
|------|---------------|
| **A01–A04** | User identity, JWT authentication, project management, Supabase persistence |
| **A05–A08** *(us)* | API gateway, React frontend dashboard — login, projects, container deploy/delete, resource monitoring |
| **A09–A11** | Basic quota system (Phase 1) → Billing engine (Phase 2) |

### BDS-8B — Data Plane

| Team | Responsibility |
|------|---------------|
| **B01–B03** | Compute service — launch, stop, delete containers via Docker SDK |
| **B04–B06** | Network isolation — per-project Docker bridge networks |
| **B07–B09** | Monitoring — CPU/memory metrics collection and storage |
| **B10–B12** | Integration & support — end-to-end testing, quota enforcement |

---

## Documentation

All documentation for the frontend lives inside `frontend/`:

| File | Contents |
|------|---------|
| [`frontend/README.md`](frontend/README.md) | Setup guide, folder structure, usage, code style |
| [`frontend/API_DOCS.md`](frontend/API_DOCS.md) | Every API endpoint the frontend calls — request/response shapes, mock swap snippets |
| [`frontend/ARCHITECTURE.md`](frontend/ARCHITECTURE.md) | Component tree, data flow diagrams, state management explanation |
| [`frontend/NIST_COMPLIANCE.md`](frontend/NIST_COMPLIANCE.md) | Maps all 5 NIST cloud characteristics to specific frontend components |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, react-router-dom v7 |
| Backend | Node.js, Express |
| Auth | JWT access token (15 min) + HttpOnly refresh cookie (7 days) |
| Database | Supabase (PostgreSQL) |
| Container runtime | Docker (managed by BDS-8B) |


---

## License

This project is licensed under the [MIT License](LICENSE).


---

<div align="center">
  <sub>Built with ☕ by students of BDS-8A &amp; BDS-8B</sub>
</div>
