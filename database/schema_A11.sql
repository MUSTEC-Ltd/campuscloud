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



