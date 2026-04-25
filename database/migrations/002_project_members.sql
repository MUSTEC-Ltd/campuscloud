-- Project membership / role-based access
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
    added_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- Backfill: every existing project's owner becomes a member with role 'owner'
INSERT INTO project_members (project_id, user_id, role)
SELECT id, owner_id, 'owner' FROM projects
ON CONFLICT (project_id, user_id) DO NOTHING;
