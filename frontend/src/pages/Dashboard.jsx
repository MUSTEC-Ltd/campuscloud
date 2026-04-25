import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects } from '../api/projects';
import { getInstances, getStats, simulateTick } from '../api/instances';

const DEFAULT_HOST_MEMORY_CAP_MB = 2048;
const configuredHostMemoryCap = Number(import.meta.env.VITE_HOST_MEMORY_CAP_MB);
const HOST_MEMORY_CAP =
  Number.isFinite(configuredHostMemoryCap) && configuredHostMemoryCap > 0
    ? configuredHostMemoryCap
    : DEFAULT_HOST_MEMORY_CAP_MB;

function getBarColor(pct) {
  if (pct > 85) return 'var(--red)';
  if (pct > 60) return 'var(--orange)';
  return 'var(--green)';
}

function StatCard({ label, value, sub, accent, progress }) {
  return (
    <div className={`stat-card${accent ? ' stat-card--accent' : ''}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
      {progress !== undefined && (
        <div className="stat-progress-wrap">
          <div className="stat-progress-track">
            <div
              className="stat-progress-bar"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: getBarColor(progress),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceUsageTable({ instances }) {
  const running = [...instances]
    .filter((i) => i.status === 'running')
    .sort((a, b) => b.cpu - a.cpu);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Resource Usage by Container</h2>
      </div>
      {running.length === 0 ? (
        <div className="empty-state">
          <p>No active containers. Deploy one to see resource usage.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Image</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {running.map((i) => {
              const memPct = (i.memory / HOST_MEMORY_CAP) * 100;
              return (
                <tr key={i.id}>
                  <td className="td-name">{i.name}</td>
                  <td className="td-mono">{i.image}</td>
                  <td>
                    <div className="resource-bar-cell">
                      <span>{i.cpu}%</span>
                      <div className="resource-bar-track">
                        <div
                          className="resource-bar-fill"
                          style={{
                            width: `${Math.min(i.cpu, 100)}%`,
                            background: getBarColor(i.cpu),
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="resource-bar-cell">
                      <span>{i.memory} MB</span>
                      <div className="resource-bar-track">
                        <div
                          className="resource-bar-fill"
                          style={{
                            width: `${Math.min(memPct, 100)}%`,
                            background: getBarColor(memPct),
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge--green">running</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ResourceDistribution({ instances }) {
  const running = instances.filter((i) => i.status === 'running');
  const totalCpu = running.reduce((acc, i) => acc + i.cpu, 0);

  const projectMap = {};
  running.forEach((i) => {
    const key = i.project_id;
    if (!projectMap[key]) {
      projectMap[key] = {
        id: key,
        name: i.project_name || key,
        count: 0,
        cpu: 0,
        memory: 0,
      };
    }
    projectMap[key].count += 1;
    projectMap[key].cpu += i.cpu;
    projectMap[key].memory += i.memory;
  });

  const projects = Object.values(projectMap).sort((a, b) => b.cpu - a.cpu);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Resource Distribution by Project</h2>
      </div>
      {projects.length === 0 ? (
        <div className="empty-state">
          <p>No active containers. Deploy one to see project distribution.</p>
        </div>
      ) : (
        <div className="project-dist-list">
          {projects.map((p) => {
            const sharePct = totalCpu > 0 ? (p.cpu / totalCpu) * 100 : 0;
            return (
              <div key={p.id} className="project-dist-item">
                <div className="project-dist-header">
                  <span className="project-dist-name">{p.name}</span>
                  <span className="project-dist-meta">
                    {p.count} container{p.count !== 1 ? 's' : ''} · {p.cpu}% CPU · {p.memory} MB
                  </span>
                </div>
                <div className="resource-bar-track">
                  <div
                    className="resource-bar-fill"
                    style={{
                      width: `${Math.min(sharePct, 100)}%`,
                      background: 'var(--blue)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
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
  const [stats, setStats] = useState({ total: 0, running: 0, totalCpu: 0, totalMemory: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const proj = await getProjects(token);
        setProjects(proj);
        const ids = proj.map((p) => p.id);
        setInstances(getInstances(undefined, ids));
        setStats(getStats(ids));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const accessibleIds = projects.map((p) => p.id);

  useEffect(() => {
    if (accessibleIds.length === 0) return;
    const ids = accessibleIds;
    const intervalId = setInterval(() => {
      try {
        simulateTick();
        setInstances(getInstances(undefined, ids));
        setStats(getStats(ids));
      } catch (err) {
        console.error('Failed to simulate dashboard tick:', err);
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [accessibleIds.join(',')]);

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const recentInstances = [...instances]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const cpuPct = Math.min(stats.totalCpu, 100);
  const memPct = Math.min((stats.totalMemory / HOST_MEMORY_CAP) * 100, 100);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.email}</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 24 }}>{error}</div>}

      <div className="live-indicator">
        <span className="live-dot" />
        Live · updates every 3s
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Projects"
          value={loading ? '—' : projects.length}
          sub="across your account"
        />
        <StatCard
          label="Running Containers"
          value={stats.running}
          sub={`${stats.total} total deployed`}
          accent
        />
        <StatCard
          label="Total CPU Usage"
          value={`${stats.totalCpu}%`}
          sub="across all containers"
          progress={cpuPct}
        />
        <StatCard
          label="Total Memory"
          value={`${stats.totalMemory} MB`}
          sub={`of ${HOST_MEMORY_CAP} MB host cap`}
          progress={memPct}
        />
      </div>

      <div className="resource-sections">
        <ResourceUsageTable instances={instances} />
        <ResourceDistribution instances={instances} />
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
                  <th>Status</th>
                  <th>Memory</th>
                </tr>
              </thead>
              <tbody>
                {recentInstances.map((i) => (
                  <tr key={i.id}>
                    <td className="td-name">{i.name}</td>
                    <td className="td-mono">{i.image}</td>
                    <td><span className="badge badge--green">running</span></td>
                    <td className="td-muted">{i.memory} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
