/**
 * Instance/Container API — mock implementation using localStorage.
 *
 * This module mirrors the planned data-plane API surface:
 *   POST   /instance            → createInstance()
 *   DELETE /instance/:id        → deleteInstance()
 *   GET    /instances           → getInstances()
 *   GET    /instances/:projectId → getInstances(projectId)
 *
 * Visibility is enforced the same way the real backend will:
 *   every read takes `accessibleProjectIds` — the list of project IDs the
 *   current user is a member of — and only containers in that set are returned.
 *   Without that list, all reads return empty (deny-by-default).
 *
 * Swap each function body for a real fetch() call once the
 * BDS-8B compute service (B01–B03) is deployed.
 */

const STORAGE_KEY = 'campuscloud_instances';

const PRESET_IMAGES = [
  'nginx:latest',
  'redis:latest',
  'postgres:15',
  'node:18-alpine',
  'python:3.11-slim',
  'ubuntu:22.04',
];

export { PRESET_IMAGES };

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

export function getStats(accessibleProjectIds) {
  const visible = getInstances(undefined, accessibleProjectIds);
  const running = visible.filter((i) => i.status === 'running');
  return {
    total: visible.length,
    running: running.length,
    totalCpu: running.reduce((acc, i) => acc + i.cpu, 0),
    totalMemory: running.reduce((acc, i) => acc + i.memory, 0),
  };
}

export function simulateTick() {
  const instances = load();
  const updated = instances.map((i) => {
    if (i.status !== 'running') return i;
    const delta = Math.floor(Math.random() * 7) - 3; // random value in [-3, +3]
    const newCpu = Math.min(100, Math.max(1, i.cpu + delta));
    return { ...i, cpu: newCpu };
  });
  try {
    save(updated);
  } catch (err) {
    console.error('simulateTick: failed to persist to localStorage:', err);
  }
}

export function clearAllInstances() {
  localStorage.removeItem(STORAGE_KEY);
}
