import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects } from '../api/projects';
import { getInstances, getStats } from '../api/instances';
import { billingByProject, totalCost, formatCost } from '../api/billing';

function StatCard({ label, value, sub, accent, color }) {
  return (
    <div className={`stat-card${accent ? ' stat-card--accent' : ''}${color ? ` stat-card--${color}` : ''}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [instances, setInstances] = useState([]);
  const [stats, setStats] = useState({ total: 0, running: 0, totalCpu: 0, totalMemory: 0, totalReplicas: 0 });
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const proj = await getProjects(token);
        setProjects(proj);
        const ids = proj.map((p) => p.id);
        const inst = getInstances(undefined, ids);
        setInstances(inst);
        setStats(getStats(ids));
        setBilling(billingByProject(inst, proj));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const accessibleIds = projects.map((p) => p.id);
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);
  const recentInstances = [...instances]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);
  const runningCost = totalCost(instances);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.email}</p>
        </div>
        <Link to="/billing" className="btn btn--ghost">
          View Billing
        </Link>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 24 }}>{error}</div>}

      <div className="stats-grid stats-grid--5">
        <StatCard
          label="Total Projects"
          value={loading ? '—' : projects.length}
          sub="across your account"
        />
        <StatCard
          label="Running Containers"
          value={stats.running}
          sub={`${stats.totalReplicas ?? stats.total} total replicas`}
          accent
        />
        <StatCard
          label="Total CPU Usage"
          value={`${stats.totalCpu}%`}
          sub="across all replicas"
        />
        <StatCard
          label="Total Memory"
          value={`${stats.totalMemory} MB`}
          sub="allocated to replicas"
        />
        <StatCard
          label="Accrued Cost"
          value={loading ? '—' : formatCost(runningCost)}
          sub="runtime billing estimate"
          color="green"
        />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Projects</h2>
            <Link to="/projects" className="card-link">View all</Link>
          </div>
          {loading ? (
            <p className="empty-state">Loading…</p>
          ) : recentProjects.length === 0 ? (
            <div className="empty-state">
              <p>No projects yet.</p>
              <Link to="/projects" className="btn btn--primary" style={{ marginTop: 12, display: 'inline-block' }}>
                Create your first project
              </Link>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Containers</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.map((p) => {
                  const count = getInstances(p.id, accessibleIds).length;
                  return (
                    <tr key={p.id}>
                      <td className="td-name">{p.name}</td>
                      <td>
                        <span className={`badge ${count > 0 ? 'badge--green' : 'badge--gray'}`}>
                          {count} container{count !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="td-muted">{timeAgo(p.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Running Containers</h2>
            <Link to="/containers" className="card-link">View all</Link>
          </div>
          {recentInstances.length === 0 ? (
            <div className="empty-state">
              <p>No containers deployed yet.</p>
              <Link to="/containers" className="btn btn--primary" style={{ marginTop: 12, display: 'inline-block' }}>
                Deploy a container
              </Link>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Image</th>
                  <th>Replicas</th>
                  <th>Memory</th>
                </tr>
              </thead>
              <tbody>
                {recentInstances.map((i) => (
                  <tr key={i.id}>
                    <td className="td-name">{i.name}</td>
                    <td className="td-mono">{i.image}</td>
                    <td>
                      <span className="badge badge--green">{i.replicas ?? 1}×</span>
                    </td>
                    <td className="td-muted">{i.memory * (i.replicas ?? 1)} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {billing.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h2 className="card-title">Resource Consumption by Project</h2>
            <Link to="/billing" className="card-link">Full billing</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Containers</th>
                <th>CPU Usage</th>
                <th>Memory</th>
                <th>Accrued Cost</th>
              </tr>
            </thead>
            <tbody>
              {billing.map(({ project, containers, cost, cpu, memory }) => (
                <tr key={project.id}>
                  <td className="td-name">{project.name}</td>
                  <td className="td-muted">{containers.length}</td>
                  <td className="td-muted">{cpu}%</td>
                  <td className="td-muted">{memory} MB</td>
                  <td>
                    <span className="billing-cost">{formatCost(cost)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
