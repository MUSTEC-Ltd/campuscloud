import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects, createProject } from '../api/projects';
import { getInstances } from '../api/instances';
import Modal from '../components/Modal';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Projects() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = async () => {
    try {
      const data = await getProjects(token);
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateError('');
    setCreating(true);
    try {
      await createProject(newName.trim(), token);
      setNewName('');
      setShowModal(false);
      await load();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Organise your containers into isolated projects</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Project
        </button>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 24 }}>{error}</div>}

      <div className="card">
        {loading ? (
          <p className="empty-state">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <p>You don&apos;t have any projects yet.</p>
            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>
              Create your first project
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Containers</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const containerCount = getInstances(p.id).length;
                return (
                  <tr key={p.id}>
                    <td className="td-name">{p.name}</td>
                    <td>
                      <span className={`badge ${containerCount > 0 ? 'badge--green' : 'badge--gray'}`}>
                        {containerCount} container{containerCount !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="td-muted">{timeAgo(p.created_at)}</td>
                    <td>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => navigate(`/containers?project=${p.id}`)}
                      >
                        View containers
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="New Project" onClose={() => { setShowModal(false); setCreateError(''); setNewName(''); }}>
          <form onSubmit={handleCreate}>
            {createError && <div className="alert alert--error" style={{ marginBottom: 16 }}>{createError}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="proj-name">Project name</label>
              <input
                id="proj-name"
                type="text"
                className="form-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. web-app, data-pipeline"
                required
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => { setShowModal(false); setCreateError(''); setNewName(''); }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
