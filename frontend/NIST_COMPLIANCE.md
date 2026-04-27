# CampusCloud Frontend — NIST Cloud Characteristics

**Team A06 · BDS-8A · Frontend Dashboard**

This document maps each of the five NIST SP 800-145 essential cloud
characteristics to concrete, verifiable features implemented in the
CampusCloud frontend dashboard. Only frontend-owned code is referenced here.

---

## Overview

| # | NIST Characteristic | Frontend Implementation Status |
|---|--------------------|---------------------------------|
| 1 | On-Demand Self-Service | ✅ Fully implemented |
| 2 | Broad Network Access | ✅ Fully implemented |
| 3 | Resource Pooling | ✅ Implemented (per-user isolation via JWT) |
| 4 | Rapid Elasticity | ✅ Implemented (deploy / delete UI; mock backend) |
| 5 | Measured Service | ✅ Implemented (stat cards + per-container metrics) |

---

## 1. On-Demand Self-Service

> *"A consumer can unilaterally provision computing capabilities … without
> requiring human interaction with each service provider."*
> — NIST SP 800-145

### What this means
Users must be able to register, create projects, launch containers, and remove
containers entirely on their own — no admin approval, no support ticket, no
manual step on the server side.

### How the frontend delivers this

#### Self-service account creation — `pages/Register.jsx`
- Any user can create an account from the `/register` page with only an email
  and password.
- Client-side validation (email domain, password strength) gives instant
  feedback so the user can correct errors themselves, with no back-and-forth
  with an administrator.
- On success, the user is automatically logged in and redirected to the
  dashboard. No email confirmation, no admin activation.

#### Self-service project creation — `pages/Projects.jsx`
- The **New Project** modal (`Modal.jsx`) lets a user create a named project
  with a single form field and one button click.
- `createProject(name, token)` in `api/projects.js` fires `POST /project`
  and the new row appears in the table immediately on success — no page
  reload, no waiting for an operator.

#### Self-service container deployment — `pages/Containers.jsx`
- The **Deploy Container** modal lets a user:
  - Name the container
  - Choose a preset Docker image (`nginx:latest`, `redis:alpine`, etc.) or
    type a custom image tag
  - Select the target project
- `createInstance()` in `api/instances.js` provisions the container (mock
  today, real `POST /instance` when BDS-8B is live).
- The container appears in the table immediately after the modal closes.

#### Self-service container deletion — `pages/Containers.jsx`
- Every container row has a **Delete** button.
- A two-step confirmation ("Sure? Yes, delete / Cancel") prevents accidental
  deletion without requiring a support request.
- `deleteInstance(id)` removes the resource immediately.

#### No privileged path required
Every action above is available to any authenticated user. There is no
admin-only interface or approval workflow in the frontend.

---

## 2. Broad Network Access

> *"Capabilities are available over the network and accessed through standard
> mechanisms that promote use by … thin or thick client platforms."*
> — NIST SP 800-145

### What this means
The dashboard must be reachable from any standard device and browser over the
campus network — not just from a specific machine or via a special client.

### How the frontend delivers this

#### Standard web browser is the only requirement
The dashboard is a React SPA served by Vite's dev server (or `dist/` in
production). Any modern browser — Chrome, Firefox, Safari, Edge — on any
operating system can access it at `http://<host>:5173`.

#### No platform-specific software
Users do not install plugins, native apps, or VPN clients. The only
requirement is a browser and network access to the host.

#### Token-based access over plain HTTP/HTTPS
Authentication uses a JWT `Bearer` token in the `Authorization` header,
carried with every API call in `api/auth.js`, `api/projects.js`, and
`api/instances.js`. This is a universally supported mechanism that works
from any HTTP client — browser, curl, Postman, etc.

#### Session persistence across devices
`AuthContext` stores the token in `localStorage`. Any browser tab or window
that opens the app while the token is still valid will rehydrate the session
without re-login, making the service available continuously.

#### Responsive layout
`App.css` uses a fluid grid so the dashboard is usable on laptop screens and
wider without requiring a specific resolution or device form factor.

---

## 3. Resource Pooling

> *"The provider's computing resources are pooled to serve multiple consumers
> … with different physical and virtual resources dynamically assigned and
> reassigned according to consumer demand."*
> — NIST SP 800-145

### What this means
Multiple users must share the underlying infrastructure, but each user must
only see and manage their own resources. The frontend must enforce this
isolation at the UI level.

### How the frontend delivers this

#### Per-user authentication boundary — `context/AuthContext.jsx`
- Every user authenticates independently via `POST /login`, receiving their
  own JWT that encodes their `user_id`.
- The token is stored in `AuthContext` and passed to every API call. Two
  users logged in on different browsers see entirely separate data.

#### Project-scoped resource view — `pages/Projects.jsx`
- `getProjects(token)` calls `GET /project` with the user's JWT.
- The backend returns only projects whose `owner_id` matches the token
  subject. The frontend never receives or renders another user's projects.

#### Container filtering by project — `pages/Containers.jsx`
- The `?project=<id>` query parameter scopes the container list to one
  project.
- `getInstances(filterProject)` filters the mock store (and will filter the
  real API response) so a user drilling into Project A never sees containers
  belonging to Project B or another user.

#### Dashboard aggregation is per-user — `pages/Dashboard.jsx`
- Stat cards (Total Projects, Running Containers, CPU, Memory) are computed
  from only the current user's data — `getProjects(token)` +
  `getInstances()` + `getStats()`.
- No global cluster totals are exposed.

---

## 4. Rapid Elasticity

> *"Capabilities can be elastically provisioned and released … to scale
> rapidly outward and inward commensurate with demand."*
> — NIST SP 800-145

### What this means
Users must be able to launch new compute resources quickly and remove them
just as quickly. The dashboard must not impose unnecessary friction or delay
between the user's intent and the resource state change.

### How the frontend delivers this

#### One-modal container deployment — `pages/Containers.jsx`
- Clicking **Deploy Container** opens a lightweight modal.
- Three fields: name, image, project. No complex configuration required.
- Submitting the form calls `createInstance()` synchronously (mock) and
  the new container row appears in the table the moment the modal closes.
- When the real API is live, the only change is that `createInstance()`
  awaits a `POST /instance` response — the user experience stays the same.

#### Instant container removal — `pages/Containers.jsx`
- The **Delete** button + one confirmation click calls `deleteInstance(id)`.
- The row is removed from state immediately; no polling, no waiting.

#### Live container count on every page — `pages/Projects.jsx` + `pages/Dashboard.jsx`
- Each project row shows a badge with the current container count.
- The Dashboard stat card shows **Running Containers** and **Total CPU /
  Memory**, so users can see capacity change instantly after deploying or
  deleting.

#### No page reload required
All state updates use React's `useState` + local array mutations. Adding or
removing a container updates the UI in-place without a full page navigation,
keeping the interaction fast.

---

## 5. Measured Service

> *"Cloud systems automatically control and optimize resource use by leveraging
> a metering capability … Resource usage can be monitored, controlled, and
> reported, providing transparency for both the provider and consumer."*
> — NIST SP 800-145

### What this means
Users must be able to see how much of the shared platform they are consuming.
The dashboard is the primary tool through which that visibility is delivered.

### How the frontend delivers this

#### Dashboard stat cards — `pages/Dashboard.jsx`

| Stat Card | Value Shown | Source |
|-----------|-------------|--------|
| Total Projects | Count of user's projects | `getProjects(token)` |
| Running Containers | Count of containers with status `"running"` | `getStats().running` |
| Total CPU Usage | Sum of `cpu` field across all containers (%) | `getStats().totalCpu` |
| Total Memory | Sum of `memory` field across all containers (MB) | `getStats().totalMemory` |

These four cards give users an at-a-glance view of their resource footprint
every time they open the dashboard.

#### Per-container resource display — `pages/Containers.jsx`
The container table exposes per-row metrics:

| Column | What it shows |
|--------|---------------|
| **CPU** | CPU usage percentage for that container |
| **Memory** | Memory usage in MB for that container |
| **Status** | `running` badge (filterable; future states: `stopped`, `error`) |
| **Age** | Time since the container was deployed (`timeAgo()`) |

This lets users identify which specific containers are consuming the most
resources without needing to leave the dashboard.

#### Per-project container count — `pages/Projects.jsx`
Each project row shows a badge (`N containers`) derived from
`getInstances(project.id).length`. Users can see at a glance which projects
have active resources and which are idle.

#### `getStats()` — `api/instances.js`
The `getStats()` function aggregates the instance list into the four metrics
displayed on the Dashboard. When the mock is replaced with a real API call,
the same aggregation logic will run over live data returned by
`GET /instances`, and the Dashboard will reflect true cluster-level usage
without any UI changes.

#### Transparency by design
All resource data is presented to the user who owns it — not hidden behind an
admin view. This aligns directly with the NIST principle of providing
transparency to the consumer.

---

## Summary Table

| NIST Characteristic | Key Frontend Feature | File(s) |
|--------------------|---------------------|---------|
| On-Demand Self-Service | Register without admin; create projects; deploy & delete containers without any manual step | `Register.jsx`, `Projects.jsx`, `Containers.jsx` |
| Broad Network Access | Browser-only SPA over HTTP; JWT over standard `Authorization` header; no special client | `AuthContext.jsx`, `api/auth.js`, all pages |
| Resource Pooling | JWT scopes all API calls to the authenticated user; project-level container filtering | `AuthContext.jsx`, `api/projects.js`, `Containers.jsx` |
| Rapid Elasticity | Single-modal deploy; one-click delete; instant UI state update; no page reload | `Containers.jsx`, `api/instances.js` |
| Measured Service | Dashboard stat cards (CPU, memory, containers, projects); per-container CPU/memory columns | `Dashboard.jsx`, `Containers.jsx`, `api/instances.js` |
