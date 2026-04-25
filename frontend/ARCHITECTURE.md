# CampusCloud Frontend — Architecture Diagram

**Team A06 · BDS-8A · Phase 1 + Phase 2**

---

## High-Level Component Tree

```
<App>  (React Router)
│
├── /login       → <Login />
├── /register    → <Register />
│
└── <ProtectedRoute>        (redirects to /login if no token)
      └── <Layout>          (sidebar shell + demo banner)
            ├── /dashboard  → <Dashboard />
            ├── /projects   → <Projects />
            ├── /containers → <Containers />
            └── /billing    → <Billing />       ← Phase 2
```

---

## Internal Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       BROWSER  (React SPA)                           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                     AuthContext                              │     │
│  │  token · user · demoMode                                    │     │
│  │  login(token, user, demoMode) / logout()                    │     │
│  └────────────────────────────┬────────────────────────────────┘     │
│                               │                                      │
│  ┌──────────┐ ┌──────────────┐│┌──────────────┐ ┌────────────────┐  │
│  │ Login /  │ │  Dashboard   ││ │  Projects    │ │  Containers    │  │
│  │ Register │ │ stats+trends ││ │  list+create │ │ deploy+scale   │  │
│  └────┬─────┘ └──────┬───────┘│└──────┬───────┘ └──────┬─────────┘  │
│       │              │        │       │                 │            │
│       │              │  ┌─────┴──┐    │                 │            │
│       │              │  │Billing │    │                 │            │
│       │              │  │ page   │    │                 │            │
│       │              │  └────────┘    │                 │            │
│  ─────┴──────────────┴───────────────┴─────────────────┴─────────── │
│                          API Layer  (src/api/)                       │
│                                                                      │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────┐  ┌───────────┐  │
│  │ auth.js  │  │projects.js │  │  instances.js    │  │billing.js │  │
│  │          │  │            │  │  (localStorage   │  │           │  │
│  │ login()  │  │getProjects │  │   mock)          │  │container  │  │
│  │ register │  │createProj  │  │ getInstances()   │  │  Cost()   │  │
│  │ logout() │  │getMembers  │  │ createInstance() │  │billing    │  │
│  │          │  │addMember   │  │ deleteInstance() │  │ ByProject │  │
│  │ Demo mode│  │removeMemb  │  │ scaleInstance()  │  │totalCost  │  │
│  │ fallback │  │Demo mode   │  │ getStats()       │  │           │  │
│  └────┬─────┘  └─────┬──────┘  └────────┬─────────┘  └───────────┘  │
│       │              │                  │                            │
│  ─────┴──────────────┴──────────────────┴──────────────────────────  │
│                   mock-seed.js                                       │
│   isDemoMode() / enableDemoMode() / getDemoProjects()                │
│   DEMO_TOKEN · DEMO_USER_ID · seed data (3 projects, 6 containers)  │
└──────────────────────────────────────────────────────────────────────┘
        │  Bearer JWT          │  Bearer JWT        │  localStorage
        │  (or demo token)     │  (or demo data)    │  (mock store)
        ▼                      ▼                    ▼
┌───────────────────────────────────┐   ┌────────────────────────┐
│   Backend REST API  (:5000)       │   │  localStorage          │
│   (A01–A04, live when available)  │   │  (mock data store)     │
│                                   │   │                        │
│   POST /login                     │   │  "campuscloud_         │
│   POST /register                  │   │   instances" key       │
│   POST /logout                    │   │  "cc_demo_projects"    │
│   GET  /project                   │   │  "cc_demo" flag        │
│   POST /project                   │   └────────────────────────┘
│   GET  /project/:id/members       │
│   POST /project/:id/members       │
│   DELETE /project/:id/members/:id │
└───────────────────────────────────┘
```

---

## Component Descriptions

### Pages

| Page | File | Responsibility |
|------|------|----------------|
| Login | `pages/Login.jsx` | Email + password form; on network failure auto-enters demo mode |
| Register | `pages/Register.jsx` | Account creation with password strength validation |
| Dashboard | `pages/Dashboard.jsx` | Stat cards (5: projects, containers, CPU, memory, cost); recent project/container tables; per-project resource trends |
| Projects | `pages/Projects.jsx` | Fetches and lists user projects; create modal; members modal |
| Containers | `pages/Containers.jsx` | Lists containers; deploy modal; replica scale +/- controls; delete |
| Billing | `pages/Billing.jsx` | (**Phase 2**) Per-project and per-container cost breakdown using billing formula |

### Shared Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Layout | `components/Layout.jsx` | App shell — renders `<Sidebar />` + `<Outlet />`; shows demo mode banner |
| Sidebar | `components/Sidebar.jsx` | Navigation (Dashboard, Projects, Containers, Billing); demo mode tag |
| Modal | `components/Modal.jsx` | Generic dialog; closes on Escape or backdrop click |
| ProtectedRoute | `components/ProtectedRoute.jsx` | Reads `AuthContext`; redirects to `/login` if no token |

### Context

| Context | File | What it holds |
|---------|------|---------------|
| AuthContext | `context/AuthContext.jsx` | `token`, `user`, `demoMode` flag; `login(token, user, demo)`, `logout()`; persists to `localStorage` |

### API Modules

| Module | File | Real or Mock |
|--------|------|-------------|
| auth | `api/auth.js` | **Real** (with demo fallback on `TypeError`) |
| projects | `api/projects.js` | **Real** (returns mock data in demo mode) |
| instances | `api/instances.js` | **Mock** localStorage + scale support |
| billing | `api/billing.js` | **Computed** from instances (no network) |
| mock-seed | `api/mock-seed.js` | Demo data seed — 3 projects, 6 containers |

---

## Demo Mode

When the backend is unreachable (`TypeError` on `fetch`), login automatically enters **Demo Mode**:

1. `auth.js` catches the `TypeError` and calls `enableDemoMode()`
2. `enableDemoMode()` sets `cc_demo=1` in localStorage and seeds mock projects + containers
3. `AuthContext` stores `demoMode: true` and passes it through context
4. `Layout` renders a yellow warning banner
5. `Sidebar` shows a "demo" tag next to the user avatar
6. `projects.js` reads from `cc_demo_projects` (localStorage) instead of the API
7. `instances.js` reads/writes `campuscloud_instances` (localStorage) as normal

To exit demo mode, the user logs out — `disableDemoMode()` clears all demo keys.

---

## Data Flows

### Login (with demo fallback)

```
User submits form
      │
      ▼
Login.jsx → auth.js → POST /login { email, password }
      │
      ├── success → { accessToken, user, demoMode: false }
      │              AuthContext.login(token, user, false)
      │              navigate("/dashboard")
      │
      └── TypeError (network down) → enableDemoMode()
                                     return { accessToken: DEMO_TOKEN, user, demoMode: true }
                                     AuthContext.login(token, user, true)
                                     navigate("/dashboard")
```

### Container Scaling (Phase 2)

```
User clicks +/- on a container row
      │
      ▼
Containers.jsx → scaleInstance(id, ±1, accessibleIds)
      │
      ▼
instances.js clamps replicas to [1, 5] and writes to localStorage
      │
      ▼
Containers.jsx calls refresh() → list re-renders with new replica count
```

### Billing Calculation (Phase 2)

```
Dashboard / Billing page loads
      │
      ▼
getProjects(token) + getInstances(undefined, ids)
      │
      ▼
billingByProject(instances, projects)
  └── for each instance: cost = (runtime_minutes × 2 + memory_MB × 0.01) × replicas
      │
      ▼
Render per-project cost breakdown
```

---

## State Management

No external state library. State lives in two places:

| Location | What lives there |
|----------|-----------------|
| `AuthContext` (React Context) | JWT token, logged-in user, demo mode flag |
| Page-level `useState` | Lists, loading flags, modal state, error messages |

---

## Routing Summary

| Path | Component | Protected |
|------|-----------|:---------:|
| `/login` | `Login` | No |
| `/register` | `Register` | No |
| `/dashboard` | `Dashboard` | ✅ |
| `/projects` | `Projects` | ✅ |
| `/containers` | `Containers` | ✅ |
| `/billing` | `Billing` | ✅ |
| `*` | Redirect → `/dashboard` | — |

---

## Mock → Real API Swap Points

| Function | Current | Planned real endpoint |
|----------|---------|----------------------|
| `getInstances(projectId?)` | localStorage | `GET /instances?project_id=<id>` |
| `createInstance(data)` | localStorage | `POST /instance` |
| `deleteInstance(id)` | localStorage | `DELETE /instance/:id` |
| `scaleInstance(id, delta)` | localStorage | `PUT /instance/:id/scale { replicas }` |
| `getStats()` | derived locally | derived from `GET /instances` |
| billing functions | computed locally | `GET /billing/:project_id`, `GET /usage/:project_id` |
| `GET /metrics/:project_id` | not yet | Phase 2 monitoring API |
