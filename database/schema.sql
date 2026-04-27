-- ============================================================
-- CampusCloud — Canonical Database Schema
-- Source of truth for all teams.
-- Run via: backend/scripts/setup_db.js  (uses backend/schema.sql)
-- Or apply manually in order using the migrations/ folder.
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh tokens (HttpOnly cookie-based session management)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token      TEXT UNIQUE NOT NULL,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project membership / role-based access
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    added_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- Project resource quotas (A09–A11)
CREATE TABLE IF NOT EXISTS project_quotas (
    project_id    UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    max_containers INTEGER NOT NULL DEFAULT 3
);

-- Container registry (BDS-8B data plane)
CREATE TABLE IF NOT EXISTS containers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    container_name TEXT NOT NULL,
    image          TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'deleted')),
    replicas       INTEGER NOT NULL DEFAULT 1 CHECK (replicas BETWEEN 1 AND 5),
    cpu_limit      REAL,
    memory_limit   INTEGER,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_owner        ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status       ON projects(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_project_members_user  ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_containers_project    ON containers(project_id);

-- Unique: no two active projects with the same name per owner
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_project_name
    ON projects (name, owner_id) WHERE status = 'active';

-- ============================================================
-- Backfill: existing project owners become project_members
-- (safe to run multiple times)
-- ============================================================
INSERT INTO project_members (project_id, user_id, role)
SELECT id, owner_id, 'owner' FROM projects
ON CONFLICT (project_id, user_id) DO NOTHING;
