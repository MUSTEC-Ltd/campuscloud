/**
 * Instance/Container API — mock implementation using localStorage.
 *
 * Mirrors the planned data-plane API:
 *   POST   /instance              → createInstance()
 *   DELETE /instance/:id          → deleteInstance()
 *   GET    /instances             → getInstances()
 *   GET    /instances/:project_id → getInstances(projectId)
 *   PUT    /instance/:id/scale    → scaleInstance()   (Phase 2)
 *
 * Replace function bodies with real fetch() calls when BDS-8B deploys.
 */

const STORAGE_KEY = 'campuscloud_instances';
const MAX_REPLICAS = 5;

export const PRESET_IMAGES = [
  'nginx:latest',
  'redis:latest',
  'postgres:15',
  'node:18-alpine',
  'python:3.11-slim',
  'ubuntu:22.04',
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function save(instances) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(instances));
}

function allowSet(accessibleProjectIds) {
  if (!Array.isArray(accessibleProjectIds)) return null;
  return new Set(accessibleProjectIds);
}

export function getInstances(projectId, accessibleProjectIds) {
  const allow = allowSet(accessibleProjectIds);
  if (!allow) return [];
  if (projectId && !allow.has(projectId)) return [];
  const all = load();
  if (projectId) return all.filter((i) => i.project_id === projectId);
  return all.filter((i) => allow.has(i.project_id));
}

export function createInstance(
  { name, image, project_id, project_name, owner_id },
  accessibleProjectIds
) {
  const allow = allowSet(accessibleProjectIds);
  if (!allow || !allow.has(project_id)) {
    throw new Error('You do not have access to this project.');
  }
  const instances = load();
  const newInstance = {
    id: crypto.randomUUID(),
    name,
    image,
    project_id,
    project_name: project_name ?? project_id,
    owner_id: owner_id ?? null,
    status: 'running',
    cpu: Math.floor(Math.random() * 25) + 1,
    memory: (Math.floor(Math.random() * 7) + 1) * 64,
    replicas: 1,
    created_at: new Date().toISOString(),
  };
  instances.push(newInstance);
  save(instances);
  return newInstance;
}

export function deleteInstance(id, accessibleProjectIds) {
  const allow = allowSet(accessibleProjectIds);
  if (!allow) return;
  const all = load();
  const target = all.find((i) => i.id === id);
  if (!target) return;
  if (!allow.has(target.project_id)) {
    throw new Error('You do not have access to this container.');
  }
  save(all.filter((i) => i.id !== id));
}

export function scaleInstance(id, delta, accessibleProjectIds) {
  const allow = allowSet(accessibleProjectIds);
  if (!allow) throw new Error('No accessible projects.');
  const all = load();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error('Container not found.');
  if (!allow.has(all[idx].project_id)) {
    throw new Error('You do not have access to this container.');
  }
  const current = all[idx].replicas ?? 1;
  const next = Math.max(1, Math.min(MAX_REPLICAS, current + delta));
  all[idx] = { ...all[idx], replicas: next };
  save(all);
  return all[idx];
}

export function getStats(accessibleProjectIds) {
  const visible = getInstances(undefined, accessibleProjectIds);
  const running = visible.filter((i) => i.status === 'running');
  return {
    total: visible.length,
    running: running.length,
    totalCpu: running.reduce((acc, i) => acc + i.cpu * (i.replicas ?? 1), 0),
    totalMemory: running.reduce((acc, i) => acc + i.memory * (i.replicas ?? 1), 0),
    totalReplicas: running.reduce((acc, i) => acc + (i.replicas ?? 1), 0),
  };
}

export function clearAllInstances() {
  localStorage.removeItem(STORAGE_KEY);
}
