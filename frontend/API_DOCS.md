# CampusCloud — API Documentation

Base URL: `http://localhost:5000` (development)

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```
Access tokens expire after **15 minutes**. Refresh tokens are stored in an
HttpOnly cookie (`refreshToken`) and expire after **7 days**.

---

## Authentication

### POST /register

Create a new user account.

**Request body**
```json
{
  "email": "student@university.edu",
  "password": "SecurePass1!"
}
```

**Email rules:** must be `@gmail.com` or end with `.edu`

**Password rules:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (`!@#$%^&*(),.?":{}|<>`)

**Success — 201 Created**
```json
{
  "message": "User registered successfully",
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "student@university.edu"
  }
}
```

**Error responses**
| Status | Condition |
|--------|-----------|
| 400 | Validation failed (email format, password rules) |
| 400 | User already exists |
| 500 | Server error |

---

### POST /login

Authenticate an existing user.

**Request body**
```json
{
  "email": "student@university.edu",
  "password": "SecurePass1!"
}
```

**Success — 200 OK**
```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "student@university.edu"
  }
}
```
Sets `refreshToken` HttpOnly cookie (7-day expiry).

**Error responses**
| Status | Condition |
|--------|-----------|
| 400 | Missing / invalid email or password field |
| 401 | Invalid credentials |
| 500 | Server error |

---

### POST /logout

Revoke the current refresh token.

**No request body required.**
Reads the `refreshToken` cookie automatically.

**Success — 200 OK**
```json
{ "message": "Logged out successfully" }
```
Clears the `refreshToken` cookie.

---

## Projects

All project endpoints require a valid `Authorization: Bearer <token>` header.

### GET /project

List all projects owned by the authenticated user.

**Success — 200 OK**
```json
[
  {
    "id": "uuid",
    "name": "web-app",
    "owner_id": "uuid",
    "created_at": "2026-03-22T10:00:00.000Z"
  }
]
```

Returns an empty array `[]` if the user has no projects.

**Error responses**
| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT |
| 500 | Server error |

---

### POST /project

Create a new project.

**Request body**
```json
{ "name": "my-new-project" }
```

**Success — 201 Created**
```json
{
  "id": "uuid",
  "name": "my-new-project",
  "owner_id": "uuid",
  "created_at": "2026-03-22T10:05:00.000Z"
}
```

**Error responses**
| Status | Condition |
|--------|-----------|
| 400 | `name` field missing |
| 401 | Missing or invalid JWT |
| 500 | Server error |

---

## Containers / Instances (Planned — BDS-8B Data Plane)

These endpoints are **not yet implemented**. The frontend currently uses a
localStorage mock (`src/api/instances.js`). Replace each mock function body
with a real `fetch()` call when the data plane goes live.

### POST /instance

Launch a new Docker container.

**Request body**
```json
{
  "name": "nginx-web",
  "image": "nginx:latest",
  "project_id": "uuid",
  "cpu_limit": 1.0,
  "memory_limit_mb": 512
}
```

**Success — 201 Created**
```json
{
  "id": "uuid",
  "name": "nginx-web",
  "image": "nginx:latest",
  "project_id": "uuid",
  "status": "running",
  "cpu": 0,
  "memory": 0,
  "created_at": "2026-03-22T10:10:00.000Z"
}
```

---

### DELETE /instance/:id

Stop and remove a container.

**URL params:** `id` — the container UUID

**Success — 200 OK**
```json
{ "message": "Instance deleted successfully" }
```

**Error responses**
| Status | Condition |
|--------|-----------|
| 404 | Instance not found |
| 401 | Missing or invalid JWT |

---

### GET /instances

List all containers for the authenticated user (across all projects).

**Query params (optional):** `?project_id=<uuid>` to filter by project

**Success — 200 OK**
```json
[
  {
    "id": "uuid",
    "name": "nginx-web",
    "image": "nginx:latest",
    "project_id": "uuid",
    "status": "running",
    "cpu": 12,
    "memory": 128,
    "created_at": "2026-03-22T10:10:00.000Z"
  }
]
```

---

### GET /metrics/:project_id

Retrieve CPU and memory usage for all containers in a project.
(Planned — BDS-8B Monitoring, B07–B09)

**Success — 200 OK**
```json
{
  "project_id": "uuid",
  "containers": [
    {
      "id": "uuid",
      "name": "nginx-web",
      "cpu_percent": 12.4,
      "memory_mb": 128,
      "collected_at": "2026-03-22T10:15:00.000Z"
    }
  ]
}
```

---

### GET /usage/:project_id

Retrieve cumulative resource usage for billing.
(Planned — A09–A11 Billing Engine)

**Success — 200 OK**
```json
{
  "project_id": "uuid",
  "runtime_minutes": 240,
  "memory_mb": 512
}
```

---

### GET /billing/:project_id

Retrieve calculated cost for a project.
(Planned — A09–A11 Billing Engine)

**Formula:** `Cost = (runtime_minutes × 2) + (memory_mb × 0.01)`

**Success — 200 OK**
```json
{
  "project_id": "uuid",
  "cost": 485.12,
  "breakdown": {
    "runtime_cost": 480.00,
    "memory_cost": 5.12
  }
}
```

---

## Frontend API Integration Points

| Frontend File | Functions | Backend Endpoint |
|--------------|-----------|-----------------|
| `src/api/auth.js` | `login()` | `POST /login` |
| `src/api/auth.js` | `register()` | `POST /register` |
| `src/api/auth.js` | `logout()` | `POST /logout` |
| `src/api/projects.js` | `getProjects()` | `GET /project` |
| `src/api/projects.js` | `createProject()` | `POST /project` |
| `src/api/instances.js` | `getInstances()` | `GET /instances` *(mock)* |
| `src/api/instances.js` | `createInstance()` | `POST /instance` *(mock)* |
| `src/api/instances.js` | `deleteInstance()` | `DELETE /instance/:id` *(mock)* |
| `src/api/instances.js` | `getStats()` | derived from `GET /instances` *(mock)* |

---

## Error Format

All error responses follow this shape:
```json
{
  "message": "Human-readable error description",
  "errors": [ ... ]   // Optional: array of validation errors
}
```
