import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects } from '../api/projects';
import { getInstances } from '../api/instances';
import { billingByProject, totalCost, containerCost, runtimeMinutes, formatCost } from '../api/billing';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Billing() {
  const { token } = useAuth();
  const [projectBilling, setProjectBilling] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const projects = await getProjects(token);
        const ids = projects.map((p) => p.id);
        const instances = getInstances(undefined, ids);
        setProjectBilling(billingByProject(instances, projects));
        setGrandTotal(totalCost(instances));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">
            Accrued costs based on runtime, CPU, and memory usage
          </p>
        </div>
        <Link to="/dashboard" className="btn btn--ghost">Back to Dashboard</Link>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 24 }}>{error}</div>}

      <div className="billing-formula card" style={{ marginBottom: 16 }}>
        <p className="billing-formula-label">Billing formula (from spec)</p>
        <code className="billing-formula-code">
          Cost = (runtime_minutes × 2) + (memory_MB × 0.01) — per replica
        </code>
      </div>

      {loading ? (
        <p className="empty-state">Loading billing data…</p>
      ) : projectBilling.length === 0 ? (
        <div className="empty-state">
          <p>No projects found. <Link to="/projects">Create a project</Link> to start tracking costs.</p>
        </div>
      ) : (
        <>
          <div className="billing-total-banner">
            <span className="billing-total-label">Total accrued cost across all projects</span>
            <span className="billing-total-value">{formatCost(grandTotal)}</span>
          </div>

          {projectBilling.map(({ project, containers, cost, cpu, memory }) => (
            <section key={project.id} className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div>
                  <h2 className="card-title">{project.name}</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                    {containers.length} container{containers.length !== 1 ? 's' : ''} · {cpu}% total CPU · {memory} MB total memory
                  </p>
                </div>
                <div className="billing-project-cost">
                  <span className="billing-cost">{formatCost(cost)}</span>
                  <Link to={`/containers?project=${project.id}`} className="card-link" style={{ marginLeft: 12 }}>
                    View containers
                  </Link>
                </div>
              </div>

              {containers.length > 0 && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Container</th>
                      <th>Image</th>
                      <th>Replicas</th>
                      <th>Memory</th>
                      <th>Runtime</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((inst) => {
                      const mins = runtimeMinutes(inst);
                      const replicas = inst.replicas ?? 1;
                      const h = Math.floor(mins / 60);
                      const m = mins % 60;
                      const runtimeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
                      return (
                        <tr key={inst.id}>
                          <td className="td-name">{inst.name}</td>
                          <td className="td-mono">{inst.image}</td>
                          <td className="td-muted">{replicas}×</td>
                          <td className="td-muted">{inst.memory * replicas} MB</td>
                          <td className="td-muted">{runtimeStr}</td>
                          <td>
                            <span className="billing-cost billing-cost--sm">
                              {formatCost(containerCost(inst))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
