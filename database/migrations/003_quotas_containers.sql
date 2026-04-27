-- Migration 003: Project quotas and container registry (A09–A11, BDS-8B)

CREATE TABLE IF NOT EXISTS project_quotas (
    project_id    UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    max_containers INTEGER NOT NULL DEFAULT 3
);

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

CREATE INDEX IF NOT EXISTS idx_containers_project ON containers(project_id);
