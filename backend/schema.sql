-- Create Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Refresh Tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

--A11 code for database (Store quota info in the database)

CREATE TABLE project_quotas (
    project_id TEXT PRIMARY KEY,
    max_containers INTEGER DEFAULT 3
);

CREATE TABLE containers (
    id SERIAL PRIMARY KEY,
    project_id TEXT REFERENCES project_quotas(project_id),
    container_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



