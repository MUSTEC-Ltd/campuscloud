# Project API Documentation

All endpoints require `Authorization: Bearer <jwt_token>` header.
Base URL: `http://localhost:5000`

---

## POST /project

Creates a new project for the authenticated user.

**Request Body:**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | Yes | 2-50 chars, `[a-zA-Z0-9_-]` only, unique per user |
| description | string | No | Max 500 chars, defaults to `""` |

**Example:**
```json
{ "name": "my-web-app", "description": "A containerized web app" }
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ "message": "Project created successfully", "project": { id, name, description, owner_id, status, created_at } }` |
| 400 | `{ "error": "Validation failed", "details": [...] }` |
| 409 | `{ "error": "Project name already exists", "message": "You already have a project named '<name>'." }` |
| 401 | `{ "error": "Authentication required" }` |

---

## GET /project

Returns all active projects for the authenticated user.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "my-web-app",
    "description": "A containerized web app",
    "owner_id": "uuid",
    "status": "active",
    "created_at": "2026-03-20T10:30:00.000Z"
  }
]
```

---

## PUT /project/:id

Updates name and/or description of an existing project. Both fields are optional but at least one should be provided.

**URL Params:** `id` — UUID of the project

**Request Body:**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | No | 2-50 chars, `[a-zA-Z0-9_-]` only, unique per user |
| description | string | No | Max 500 chars |

**Example:**
```json
{ "name": "renamed-app", "description": "Updated description" }
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ "message": "Project updated successfully", "project": { id, name, description, owner_id, status, created_at } }` |
| 400 | `{ "error": "Validation failed", "details": [...] }` — invalid name, description, or non-UUID id |
| 404 | `{ "error": "Project not found" }` |
| 409 | `{ "error": "Project name already exists", "message": "You already have a project named '<name>'." }` |

---

## DELETE /project/:id

Soft-deletes a project (sets status to `"deleted"`). The project will no longer appear in GET results. The project name becomes available for reuse.

**URL Params:** `id` — UUID of the project

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ "message": "Project deleted successfully" }` |
| 400 | `{ "error": "Validation failed", "details": [...] }` — non-UUID id |
| 404 | `{ "error": "Project not found" }` |

---

## Common Errors (All Endpoints)

| Status | Error | When |
|--------|-------|------|
| 401 | `Authentication required` | Missing or malformed Authorization header |
| 401 | `Token expired` | JWT has expired |
| 401 | `Invalid token` | JWT is invalid |
| 500 | `Internal server error` | Unexpected server failure |
