# NIST Cloud Characteristics — CampusCloud Mapping

**Team A06 · BDS-8A · Updated: Phase 1 + Phase 2**

NIST SP 800-145 defines five essential cloud characteristics. This document maps each
characteristic to concrete CampusCloud frontend and backend implementations.

---

## 1. On-Demand Self-Service

> A consumer can unilaterally provision computing capabilities — such as server time and network storage — as needed, without requiring human interaction with each service provider.

### Frontend implementation (A06)

| Feature | Where |
|---------|-------|
| User registers and logs in without admin involvement | `pages/Login.jsx`, `pages/Register.jsx` |
| User creates projects with a single form submission | `pages/Projects.jsx` → `POST /project` |
| User deploys containers via the Deploy modal | `pages/Containers.jsx` → `createInstance()` |
| User deletes containers immediately | `pages/Containers.jsx` → `deleteInstance()` |
| User scales replicas up/down with +/- buttons | `pages/Containers.jsx` → `scaleInstance()` *(Phase 2)* |

### Backend implementation (A01–A04, B01–B03)
- `POST /register`, `POST /login` — self-service identity
- `POST /instance` — on-demand container launch via Docker SDK
- `DELETE /instance/:id` — on-demand teardown

---

## 2. Broad Network Access

> Capabilities are available over the network and accessed through standard mechanisms that promote use by heterogeneous thin or thick client platforms.

### Frontend implementation (A06)

| Feature | Where |
|---------|-------|
| React SPA accessible from any browser on the network | `frontend/` (Vite dev server or static build) |
| All API calls use standard HTTP/JWT over port 5000 | `src/api/auth.js`, `src/api/projects.js` |
| No desktop client required — fully browser-based dashboard | All pages |

### Backend implementation (A01–A04)
- Express server with CORS enabled, accessible at `http://<host>:5000`
- JWT tokens transported via `Authorization: Bearer` header (standard RFC 6750)

---

## 3. Resource Pooling

> The provider's computing resources are pooled to serve multiple consumers using a multi-tenant model, with different physical and virtual resources dynamically assigned and reassigned according to consumer demand.

### Frontend implementation (A06)

| Feature | Where |
|---------|-------|
| Multiple users each see only their own projects | `GET /project` filters by `project_members` membership |
| Project-scoped container visibility enforced in API layer | `src/api/instances.js` — deny-by-default `allowSet()` |
| Role-based access (owner / editor / viewer) per project | `pages/Projects.jsx`, `components/MembersModal.jsx` |
| Dashboard aggregates resources across all user projects | `pages/Dashboard.jsx` → `getStats()` |

### Backend implementation (A01–A04, B01–B03)
- Single Docker host runs containers for all projects simultaneously
- `project_members` table enforces multi-tenant data isolation
- `project_quotas` table (A09–A11) caps containers per project

---

## 4. Rapid Elasticity

> Capabilities can be elastically provisioned and released — in some cases automatically — to scale rapidly outward and inward commensurate with demand.

### Frontend implementation (A06 — Phase 2)

| Feature | Where |
|---------|-------|
| Per-container replica scale controls (+/- buttons, range 1–5) | `pages/Containers.jsx` → `scaleInstance()` |
| Replica count reflected in all stats, billing, and trends | `api/instances.js getStats()`, `api/billing.js` |
| Visual feedback: replica count shown inline in containers table | `pages/Containers.jsx` |

### Backend implementation (B01–B03 — Phase 2)
- `PUT /instance/:id/scale { replicas }` — adjusts container count
- Quota enforcement prevents exceeding project limits during scale-up
- Docker SDK spawns or removes containers to match requested replica count

---

## 5. Measured Service

> Cloud systems automatically control and optimize resource use by leveraging a metering capability at some level of abstraction. Resource usage can be monitored, controlled, and reported — providing transparency for both the provider and consumer.

### Frontend implementation (A06 — Phase 2)

| Feature | Where |
|---------|-------|
| Dashboard stat cards: CPU%, memory MB, accrued cost | `pages/Dashboard.jsx` — 5th stat card |
| Per-project resource consumption trends table | `pages/Dashboard.jsx` — Resource Consumption section |
| Full billing breakdown page with formula shown | `pages/Billing.jsx` |
| Per-container cost: `(runtime_min × 2 + memory_MB × 0.01) × replicas` | `api/billing.js` |
| Replica-aware memory and CPU totals | `api/instances.js getStats()` |

### Backend implementation (A09–A11, B07–B09 — Phase 2)
- `GET /usage/:project_id` — resource usage API
- `GET /billing/:project_id` — billing engine (formula: `runtime_min × 2 + memory_MB × 0.01`)
- `GET /metrics/:project_id` — time-series CPU/memory data from Docker stats

---

## Summary Table

| NIST Characteristic | Phase 1 Frontend | Phase 2 Frontend | Backend |
|---------------------|:----------------:|:----------------:|:-------:|
| On-Demand Self-Service | ✅ login, projects, deploy, delete | ✅ + scale replicas | ✅ |
| Broad Network Access | ✅ browser SPA, HTTP/JWT | ✅ (unchanged) | ✅ |
| Resource Pooling | ✅ multi-tenant project isolation | ✅ (unchanged) | ✅ |
| Rapid Elasticity | ⚠️ deploy/delete only | ✅ replica scaling | 🔄 planned |
| Measured Service | ⚠️ basic CPU/memory stats | ✅ billing + trends | 🔄 planned |

**Legend:** ✅ implemented · ⚠️ partial · 🔄 planned
