# CampusCloud — Frontend Dashboard

**Team A06 · BDS-8A · React + Vite**

The CampusCloud frontend is a single-page React application that acts as the
self-service dashboard for the platform. Users can register, log in, create
projects, and deploy / delete containers — all from their browser.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Environment Variables](#environment-variables)
4. [Folder Structure](#folder-structure)
5. [Pages & Features](#pages--features)
6. [API Layer](#api-layer)
7. [Authentication Flow](#authentication-flow)
8. [Mock Layer (Containers)](#mock-layer-containers)
9. [Routing](#routing)
10. [Swapping Mocks for Real API](#swapping-mocks-for-real-api)
11. [Code Style](#code-style)

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18.x |
| npm | 9.x |

The backend must be running (or you can use the mock layer for containers)
before the login / register / project features will work.

---

## Quick Start

```bash
# 1 — clone the repo (if you haven't already)
git clone <repo-url>
cd campuscloud/frontend

# 2 — install dependencies
npm install

# 3 — (optional) set the backend URL if it isn't on localhost:5000
cp .env.example .env      # then edit VITE_API_URL

# 4 — start the dev server
npm run dev
# → http://localhost:5173
```

To create a production build:

```bash
npm run build        # outputs to dist/
npm run preview      # serve the production build locally
```

---

## Environment Variables

Create a `.env` file in the `frontend/` directory:

```
VITE_API_URL=http://localhost:5000
```

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the backend API. Only change this if the backend is running on a different host or port. |

> **Note:** Vite only exposes variables that start with `VITE_` to the browser
> bundle. Never put secrets here.

---

## Folder Structure

```
frontend/
├── public/                  Static assets (favicon, etc.)
├── src/
│   ├── api/                 Centralised API call modules
│   │   ├── auth.js          POST /login, /register, /logout
│   │   ├── projects.js      GET /project, POST /project
│   │   └── instances.js     Mock (localStorage) — swap for real API later
│   ├── components/          Shared UI components
│   │   ├── Layout.jsx       App shell: sidebar + <Outlet />
│   │   ├── Sidebar.jsx      Navigation links
│   │   ├── Modal.jsx        Generic modal dialog (Escape to close)
│   │   └── ProtectedRoute.jsx  Redirects to /login if not authenticated
│   ├── context/
│   │   └── AuthContext.jsx  Global auth state (token + user)
│   ├── pages/
│   │   ├── Login.jsx        Sign-in page
│   │   ├── Register.jsx     Account creation page
│   │   ├── Dashboard.jsx    Overview: stats, recent projects & containers
│   │   ├── Projects.jsx     List and create projects
│   │   └── Containers.jsx   Deploy and delete containers
│   ├── App.jsx              Route definitions
│   ├── App.css              All application styles
│   └── main.jsx             React entry point
├── API_DOCS.md              Frontend API integration reference
├── ARCHITECTURE.md          A06 frontend architecture diagram
├── README.md                ← you are here
├── index.html
├── package.json
└── vite.config.js
```

---

## Pages & Features

### `/login` — Login
- Email + password form
- Calls `POST /login`, stores the JWT access token in `AuthContext`
- Redirects to `/dashboard` on success

### `/register` — Register
- Email + password form with real-time validation
- Password must be ≥ 8 chars with uppercase, lowercase, number, and special character
- Email must be `@gmail.com` or a `.edu` address
- Calls `POST /register`, auto-logs in on success

### `/dashboard` — Dashboard
- Stat cards: total projects, running containers, CPU usage, memory usage
- Recent projects list
- Recent containers list
- Fully derived from data already fetched by the Projects and Containers pages

### `/projects` — Projects
- Lists all projects for the logged-in user
- "New Project" modal to create a project (calls `POST /project`)
- Click a project to navigate to its containers

### `/containers` — Containers
- Lists all running containers (supports `?project=<id>` filter in the URL)
- "Deploy Container" modal: pick a name, Docker image, and target project
- Delete button on each card removes the container
- Currently backed by the **localStorage mock** (see below)

---

## API Layer

All network calls live in `src/api/`. **Pages never call `fetch()` directly.**

| File | Exported functions | Endpoint |
|------|--------------------|----------|
| `auth.js` | `login(email, password)` | `POST /login` |
| `auth.js` | `register(email, password)` | `POST /register` |
| `auth.js` | `logout()` | `POST /logout` |
| `projects.js` | `getProjects(token)` | `GET /project` |
| `projects.js` | `createProject(name, token)` | `POST /project` |
| `instances.js` | `getInstances(projectId?)` | mock |
| `instances.js` | `createInstance(data)` | mock |
| `instances.js` | `deleteInstance(id)` | mock |
| `instances.js` | `getStats()` | mock |

The base URL for all real calls is read from `import.meta.env.VITE_API_URL`.

---

## Authentication Flow

```
User submits Login form
        │
        ▼
api/auth.js → POST /login { email, password }
        │
        ▼
Backend returns { accessToken, user }
        │
        ▼
AuthContext.loginCtx(token, user)
  ├── saves token to React state
  ├── saves token to localStorage  (survives refresh)
  └── saves user  to localStorage
        │
        ▼
Navigate → /dashboard
```

On page reload, `AuthContext` rehydrates token and user from `localStorage`
so the session persists without a re-login.

Tokens expire after **15 minutes**. When a protected request returns `401`,
the user is redirected to `/login` automatically.

---

## Mock Layer (Containers)

Because the BDS-8B data plane is not yet live, `src/api/instances.js` stores
containers in `localStorage` instead of making real HTTP calls.

**What this means for you:**
- Container data is per-browser and resets if `localStorage` is cleared
- No real Docker containers are started
- Everything else (auth, projects) is real and calls the live backend

---

## Routing

| Path | Component | Auth required |
|------|-----------|:---:|
| `/login` | `Login.jsx` | No |
| `/register` | `Register.jsx` | No |
| `/dashboard` | `Dashboard.jsx` | ✅ |
| `/projects` | `Projects.jsx` | ✅ |
| `/containers` | `Containers.jsx` | ✅ |
| `*` (catch-all) | Redirect → `/login` | — |

Protected routes are wrapped in `<ProtectedRoute />` which checks
`AuthContext` and redirects unauthenticated visitors to `/login`.

---

## Swapping Mocks for Real API

When the BDS-8B data plane endpoints go live, open
`src/api/instances.js` and replace each function body with a real `fetch()`
call. Example:

```js
// BEFORE (mock)
export async function createInstance(data) {
  const instances = JSON.parse(localStorage.getItem('instances') || '[]');
  const newInstance = { id: crypto.randomUUID(), ...data, status: 'running' };
  localStorage.setItem('instances', JSON.stringify([...instances, newInstance]));
  return newInstance;
}

// AFTER (real API)
export async function createInstance(data, token) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/instance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create instance');
  return res.json();
}
```

No changes to any page components should be necessary — they all call through
the `api/` layer.

---

## Code Style

- **Functional components only** — no class components
- **Hooks** for all state and side-effects
- **No TypeScript** — plain JS to keep the codebase accessible to the whole team
- **No CSS-in-JS, no Tailwind** — all styles live in `App.css`
- **No inline `fetch()`** in page components — use the `src/api/` modules
- Prefer clarity over cleverness; write code the next person can read at a glance
