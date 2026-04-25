/**
 * Instance/Container API — mock implementation using localStorage.
 *
 * This module mirrors the planned data-plane API surface:
 *   POST   /instance            → createInstance()
 *   DELETE /instance/:id        → deleteInstance()
 *   GET    /instances           → getInstances()
 *   GET    /instances/:projectId → getInstances(projectId)
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

export function getInstances(projectId) {
  const all = load();
  return projectId ? all.filter((i) => i.project_id === projectId) : all;
}

export function createInstance({ name, image, project_id, project_name }) {
  const instances = load();
  const newInstance = {
    id: crypto.randomUUID(),
    name,
    image,
    project_id,
    project_name: project_name ?? project_id,
    status: 'running',
    cpu: Math.floor(Math.random() * 25) + 1,
    memory: (Math.floor(Math.random() * 7) + 1) * 64,
    created_at: new Date().toISOString(),
  };
  instances.push(newInstance);
  save(instances);
  return newInstance;
}

export function deleteInstance(id) {
  const updated = load().filter((i) => i.id !== id);
  save(updated);
}

export function getStats() {
  const instances = load();
  const running = instances.filter((i) => i.status === 'running');
  return {
    total: instances.length,
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
  save(updated);
}
