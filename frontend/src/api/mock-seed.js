const DEMO_FLAG_KEY = 'cc_demo';
const DEMO_PROJ_KEY = 'cc_demo_projects';
const INSTANCES_KEY = 'campuscloud_instances';

export const DEMO_TOKEN = 'cc-demo-mode-v1';
export const DEMO_USER_ID = 'demo-00000000-0000-0000-0000-000000000001';

const now = Date.now();
const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

const SEED_PROJECTS = [
  {
    id: 'demo-proj-0001',
    name: 'web-frontend',
    description: 'React SPA served via nginx reverse proxy',
    owner_id: DEMO_USER_ID,
    status: 'active',
    created_at: daysAgo(12),
    role: 'owner',
  },
  {
    id: 'demo-proj-0002',
    name: 'api-backend',
    description: 'Node.js REST API with Postgres and Redis',
    owner_id: DEMO_USER_ID,
    status: 'active',
    created_at: daysAgo(20),
    role: 'owner',
  },
  {
    id: 'demo-proj-0003',
    name: 'data-pipeline',
    description: 'Python batch processing workers',
    owner_id: DEMO_USER_ID,
    status: 'active',
    created_at: daysAgo(30),
    role: 'editor',
  },
];

const SEED_INSTANCES = [
  {
    id: 'demo-inst-0001',
    name: 'nginx-proxy',
    image: 'nginx:latest',
    project_id: 'demo-proj-0001',
    project_name: 'web-frontend',
    owner_id: DEMO_USER_ID,
    status: 'running',
    cpu: 12,
    memory: 128,
    replicas: 2,
    created_at: daysAgo(3),
  },
  {
    id: 'demo-inst-0002',
    name: 'react-server',
    image: 'node:18-alpine',
    project_id: 'demo-proj-0001',
    project_name: 'web-frontend',
    owner_id: DEMO_USER_ID,
    status: 'running',
    cpu: 8,
    memory: 256,
    replicas: 1,
    created_at: daysAgo(2),
  },
  {
    id: 'demo-inst-0003',
    name: 'express-api',
    image: 'node:18-alpine',
    project_id: 'demo-proj-0002',
    project_name: 'api-backend',
    owner_id: DEMO_USER_ID,
    status: 'running',
    cpu: 18,
    memory: 384,
    replicas: 3,
    created_at: daysAgo(7),
  },
  {
    id: 'demo-inst-0004',
    name: 'postgres-db',
    image: 'postgres:15',
    project_id: 'demo-proj-0002',
    project_name: 'api-backend',
    owner_id: DEMO_USER_ID,
    status: 'running',
    cpu: 22,
    memory: 512,
    replicas: 1,
    created_at: daysAgo(8),
  },
  {
    id: 'demo-inst-0005',
    name: 'redis-cache',
    image: 'redis:latest',
    project_id: 'demo-proj-0002',
    project_name: 'api-backend',
    owner_id: DEMO_USER_ID,
    status: 'running',
    cpu: 5,
    memory: 128,
    replicas: 1,
    created_at: daysAgo(6),
  },
  {
    id: 'demo-inst-0006',
    name: 'python-worker',
    image: 'python:3.11-slim',
    project_id: 'demo-proj-0003',
    project_name: 'data-pipeline',
    owner_id: DEMO_USER_ID,
    status: 'running',
    cpu: 35,
    memory: 768,
    replicas: 2,
    created_at: daysAgo(15),
  },
];

export function isDemoMode() {
  return localStorage.getItem(DEMO_FLAG_KEY) === '1';
}

export function enableDemoMode() {
  localStorage.setItem(DEMO_FLAG_KEY, '1');
  localStorage.setItem(DEMO_PROJ_KEY, JSON.stringify(SEED_PROJECTS));
  const existing = localStorage.getItem(INSTANCES_KEY);
  if (!existing || existing === '[]') {
    localStorage.setItem(INSTANCES_KEY, JSON.stringify(SEED_INSTANCES));
  }
}

export function disableDemoMode() {
  localStorage.removeItem(DEMO_FLAG_KEY);
  localStorage.removeItem(DEMO_PROJ_KEY);
}

export function getDemoProjects() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_PROJ_KEY) || 'null') ?? SEED_PROJECTS;
  } catch {
    return SEED_PROJECTS;
  }
}

export function saveDemoProjects(projects) {
  localStorage.setItem(DEMO_PROJ_KEY, JSON.stringify(projects));
}
