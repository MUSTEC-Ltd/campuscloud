# CampusCloud — Architecture Diagram

## System Overview

CampusCloud is a mini private cloud platform composed of two planes:
- **Control Plane (BDS-8A)** — user identity, project management, API gateway, and the web dashboard
- **Data Plane (BDS-8B)** — container compute, network isolation, and resource monitoring

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                           │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              FRONTEND DASHBOARD  (React/Vite)           │   │
│   │                                                         │   │
│   │  ┌──────────┐  ┌───────────┐  ┌────────────────────┐  │   │
│   │  │  Login / │  │ Projects  │  │    Containers       │  │   │
│   │  │ Register │  │   Page    │  │       Page          │  │   │
│   │  └────┬─────┘  └─────┬─────┘  └────────┬───────────┘  │   │
│   │       │              │                  │              │   │
│   │  ┌────▼──────────────▼──────────────────▼──────────┐  │   │
│   │  │               API Layer  (src/api/)              │  │   │
│   │  │  auth.js · projects.js · instances.js (mock)     │  │   │
│   │  └────────────────────┬─────────────────────────────┘  │   │
│   └───────────────────────│─────────────────────────────────┘   │
└───────────────────────────│──────────────────────────────────────┘
                            │  HTTP / REST  (Bearer JWT)
        ┌───────────────────▼─────────────────────────────┐
        │           CONTROL PLANE  (BDS-8A)                │
        │                                                  │
        │  ┌──────────────────────────────────────────┐   │
        │  │     Express Backend  (Node.js :5000)      │   │
        │  │                                          │   │
        │  │  POST /register   POST /login            │   │
        │  │  POST /logout     GET/POST /project      │   │
        │  │                                          │   │
        │  │  auth middleware (JWT verify)            │   │
        │  └─────────────┬────────────────────────────┘   │
        │                │  Supabase JS SDK               │
        │  ┌─────────────▼────────────────────────────┐   │
        │  │         Supabase (PostgreSQL)             │   │
        │  │                                          │   │
        │  │  users · refresh_tokens · projects       │   │
        │  └──────────────────────────────────────────┘   │
        └─────────────────────┬────────────────────────────┘
                              │  Docker SDK / REST
        ┌─────────────────────▼────────────────────────────┐
        │            DATA PLANE  (BDS-8B)                  │
        │                                                  │
        │  ┌──────────────┐  ┌────────────┐  ┌─────────┐  │
        │  │   Compute    │  │  Network   │  │Monitoring│  │
        │  │  Service     │  │ Isolation  │  │ Service  │  │
        │  │ (B01–B03)   │  │ (B04–B06)  │  │(B07–B09) │  │
        │  │             │  │            │  │          │  │
        │  │ POST        │  │ Docker     │  │ CPU/Mem  │  │
        │  │ /instance   │  │ Networks   │  │ metrics  │  │
        │  │ DELETE      │  │ per project│  │          │  │
        │  │ /instance   │  │            │  │ GET      │  │
        │  │ GET         │  │            │  │/metrics  │  │
        │  │ /instances  │  │            │  │/{proj_id}│  │
        │  └──────┬───────┘  └────────────┘  └─────────┘  │
        │         │                                        │
        │  ┌──────▼──────────────────────────────────────┐ │
        │  │           Docker Host (single machine)       │ │
        │  │                                             │ │
        │  │  [container-1]  [container-2]  [container-N]│ │
        │  │       │               │               │     │ │
        │  │  [project-net-A] [project-net-A] [net-B]   │ │
        │  └─────────────────────────────────────────────┘ │
        └──────────────────────────────────────────────────┘
```

## Component Descriptions

### Frontend Dashboard (our team — A06)
| Component | Responsibility |
|-----------|---------------|
| `pages/Login.jsx` | Collects credentials, calls `POST /login`, stores JWT in context |
| `pages/Register.jsx` | Account creation with password-strength validation |
| `pages/Dashboard.jsx` | Overview: stat cards (projects, containers, CPU, memory), recent items |
| `pages/Projects.jsx` | CRUD for projects; calls `GET/POST /project` |
| `pages/Containers.jsx` | Deploy/delete containers; currently mocked via localStorage |
| `context/AuthContext.jsx` | Global JWT token state, persisted in localStorage |
| `api/instances.js` | Mock layer — replace with real `fetch()` when BDS-8B is ready |

### Control Plane Backend (A01–A04)
| Module | Responsibility |
|--------|---------------|
| `routes/signup.js` | Validates email/password, hashes password, issues JWT pair |
| `routes/login.js` | Verifies credentials, issues JWT pair, sets HttpOnly cookie |
| `routes/projects.js` | JWT-protected CRUD for projects per user |
| `middleware/auth.js` | Validates `Authorization: Bearer <token>` header |
| `config/db.js` | Supabase client singleton |

### Database (Supabase / PostgreSQL)
| Table | Columns |
|-------|---------|
| `users` | `id`, `email`, `password` (bcrypt), `created_at` |
| `refresh_tokens` | `id`, `token`, `user_id`, `expires_at`, `created_at` |
| `projects` | `id`, `name`, `owner_id`, `created_at` |

### Data Plane (BDS-8B — planned)
| Service | API | Description |
|---------|-----|-------------|
| Compute (B01–B03) | `POST /instance` | Launch a Docker container with CPU/memory limits |
| Compute (B01–B03) | `DELETE /instance/:id` | Stop and remove a container |
| Compute (B01–B03) | `GET /instances` | List containers (optionally filtered by project) |
| Network (B04–B06) | — | Creates per-project Docker bridge networks |
| Monitoring (B07–B09) | `GET /metrics/:project_id` | Returns CPU/memory usage per container |

## Data Flow: Container Deployment

```
User clicks "Deploy"
       │
       ▼
Containers.jsx — validates form (name, image, project)
       │
       ▼
api/instances.js → createInstance()
       │
       ├── [NOW]   localStorage mock (instant, no network)
       │
       └── [LATER] POST /instance  { name, image, project_id }
                         │
                         ▼
                   Compute Service
                         │
                         ▼
                   docker run --name <name>
                             --network project-<project_id>
                             --cpus 1 --memory 512m
                             <image>
```

## Data Flow: Authentication

```
User submits login form
       │
       ▼
api/auth.js → POST /login { email, password }
       │
       ▼
Backend: bcrypt.compare → generateTokens()
  - accessToken  (JWT, 15 min, in response body)
  - refreshToken (random hex, 7 days, HttpOnly cookie)
       │
       ▼
AuthContext.loginCtx()
  - token saved to state + localStorage
  - user saved to state + localStorage
       │
       ▼
Navigate to /dashboard
```

## NIST Cloud Characteristics Mapping

| Characteristic | Implementation |
|---------------|----------------|
| On-Demand Self-Service | Dashboard: users deploy/delete containers without admin |
| Broad Network Access | Web dashboard accessible over the campus network |
| Resource Pooling | Multiple users share the same Docker host |
| Rapid Elasticity | Containers start/stop on demand; scaling planned in Phase 2 |
| Measured Service | Monitoring service (B07–B09) collects CPU/memory metrics |
