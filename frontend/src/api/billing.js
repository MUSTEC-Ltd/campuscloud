/**
 * Billing calculations — Phase 2 (A05–A08 Advanced Dashboard)
 *
 * Formula (from spec):
 *   Cost = (runtime_minutes × 2) + (memory_MB × 0.01)   per replica
 *
 * When GET /billing/{project_id} and GET /usage/{project_id} are live,
 * replace the exported functions with real fetch() calls and remove the
 * local computation.
 */

export function runtimeMinutes(instance) {
  return Math.floor((Date.now() - new Date(instance.created_at).getTime()) / 60000);
}

export function containerCost(instance) {
  const minutes = runtimeMinutes(instance);
  const replicas = instance.replicas ?? 1;
  return ((minutes * 2) + (instance.memory * 0.01)) * replicas;
}

export function billingByProject(instances, projects) {
  const map = new Map(
    projects.map((p) => [p.id, { project: p, containers: [], cost: 0, cpu: 0, memory: 0 }])
  );
  for (const inst of instances) {
    const entry = map.get(inst.project_id);
    if (!entry) continue;
    const replicas = inst.replicas ?? 1;
    entry.containers.push(inst);
    entry.cost += containerCost(inst);
    entry.cpu += inst.cpu * replicas;
    entry.memory += inst.memory * replicas;
  }
  return [...map.values()];
}

export function totalCost(instances) {
  return instances.reduce((sum, inst) => sum + containerCost(inst), 0);
}

export function formatCost(amount) {
  return `$${amount.toFixed(2)}`;
}
