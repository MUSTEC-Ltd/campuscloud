# Project API Documentation

All endpoints require `Authorization: Bearer <jwt_token>` header.
Base URL: `http://localhost:5000`

---

## Access model — roles

Every project has one or more **members** stored in `project_members(project_id, user_id, role)`. Roles form a hierarchy:

| Role | Can read (GET) | Can update (PUT) | Manage members | Delete project |
|------|---------------|-----------------|----------------|----------------|
| viewer | ✅ | ❌ | ❌ | ❌ |
| editor | ✅ | ✅ | ❌ | ❌ |
| owner  | ✅ | ✅ | ✅ | ✅ |

The creator of a project is automatically inserted as `owner`. All endpoints below enforce a minimum role via the `requireProjectRole` middleware. To avoid leaking the existence of other users' projects, callers with **no** membership receive `404 Project not found` rather than `403`.

When a check fails because the caller is a member but the role is too low, the response is:

```json
{ "error": "Insufficient permission", "required": "editor", "actual": "viewer" }
```

---

## POST /project

Creates a new project. Caller becomes `owner` (transactionally — the project row and the owner membership row are inserted in the same transaction).

**Request Body:**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | Yes | 2-50 chars, `[a-zA-Z0-9_-]` only, unique per owner |
| description | string | No | Max 500 chars, defaults to `""` |

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ message, project: { id, name, description, owner_id, status, created_at, role: "owner" } }` |
| 400 | `{ error: "Validation failed", details: [...] }` |
| 409 | `{ error: "Project name already exists", message: "You already have a project named '<name>'." }` |
| 401 | `{ error: "Authentication required" }` |

---

## GET /project

Returns every active project the caller is a member of (any role). Each row includes the caller's `role`.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "my-web-app",
    "description": "...",
    "owner_id": "uuid",
    "status": "active",
    "created_at": "2026-04-21T10:30:00.000Z",
    "role": "owner"
  }
]
```

---

## GET /project/:id  *(min role: viewer)*

Returns a single active project plus the caller's `role`.

| Status | Body |
|--------|------|
| 200 | `{ id, name, description, owner_id, status, created_at, role }` |
| 400 | `{ error: "Invalid project ID" }` — non-UUID id |
| 404 | `{ error: "Project not found" }` — also returned when caller has no membership |

---

## PUT /project/:id  *(min role: editor)*

Updates name and/or description.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | No | 2-50 chars, `[a-zA-Z0-9_-]` only, unique per owner |
| description | string | No | Max 500 chars |

| Status | Body |
|--------|------|
| 200 | `{ message, project: { ..., role } }` |
| 400 | Validation failure |
| 403 | `{ error: "Insufficient permission", required: "editor", actual }` |
| 404 | `{ error: "Project not found" }` |
| 409 | `{ error: "Project name already exists", message: "..." }` |

---

## DELETE /project/:id  *(min role: owner)*

Soft-deletes the project (`status='deleted'`). The name becomes available for reuse by the same owner.

| Status | Body |
|--------|------|
| 200 | `{ message: "Project deleted successfully" }` |
| 403 | `{ error: "Insufficient permission", required: "owner", actual }` |
| 404 | `{ error: "Project not found" }` |

---

## GET /project/:id/members  *(min role: viewer)*

Lists all members of a project.

**Response (200):**
```json
[
  { "user_id": "uuid", "email": "alice@gmail.com", "role": "owner",  "added_at": "..." },
  { "user_id": "uuid", "email": "bob@gmail.com",   "role": "editor", "added_at": "..." }
]
```

---

## POST /project/:id/members  *(min role: owner)*

Adds a registered user as a member, or updates their role if they already are one. Promoting another user to `owner` is intentionally not supported here — only `viewer` and `editor` are accepted.

**Request Body:**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| email | string | Yes | Email of an already-registered user |
| role | string | Yes | One of `viewer`, `editor` |

| Status | Body |
|--------|------|
| 201 | `{ message: "Member added", member: { user_id, role, added_at, email } }` |
| 400 | Validation failure |
| 403 | `{ error: "Insufficient permission", ... }` |
| 404 | `{ error: "User not registered" }` — email not found in `users` |
| 409 | `{ error: "Cannot change the project owner's role here" }` |

---

## DELETE /project/:id/members/:userId  *(min role: owner)*

Removes a member. Cannot remove the last `owner` of the project.

| Status | Body |
|--------|------|
| 200 | `{ message: "Member removed" }` |
| 403 | `{ error: "Insufficient permission", ... }` |
| 404 | `{ error: "Member not found" }` |
| 409 | `{ error: "Cannot remove the last owner" }` |

---

## Common Errors (All Endpoints)

| Status | Error | When |
|--------|-------|------|
| 401 | `Authentication required` | Missing or malformed Authorization header |
| 401 | `Token expired` | JWT has expired |
| 401 | `Invalid token` | JWT is invalid |
| 500 | `Internal server error` | Unexpected server failure |
