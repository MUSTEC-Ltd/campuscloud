import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects } from '../api/projects';
import { getInstances, createInstance, deleteInstance, PRESET_IMAGES } from '../api/instances';
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

const DEFAULT_FORM = { name: '', image: PRESET_IMAGES[0], customImage: '', project_id: '' };

export default function Containers() {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const filterProject = searchParams.get('project') ?? '';

  const [projects, setProjects] = useState([]);
  const [instances, setInstances] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [useCustomImage, setUseCustomImage] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const accessibleIds = projects.map((p) => p.id);
  const refresh = (projectList = projects) => {
    const ids = projectList.map((p) => p.id);
    setInstances(getInstances(filterProject || undefined, ids));
  };

  useEffect(() => {
    getProjects(token)
      .then((proj) => {
        setProjects(proj);
        refresh(proj);
      })
      .catch(() => { refresh([]); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterProject]);

  const handleDeploy = (e) => {
    e.preventDefault();
    if (!form.project_id) { setDeployError('Please select a project.'); return; }
    setDeployError('');
    setDeploying(true);
    const image = useCustomImage ? form.customImage.trim() : form.image;
    if (!image) { setDeployError('Please specify a Docker image.'); setDeploying(false); return; }
    const project = projects.find((p) => p.id === form.project_id);
    if (project && project.role === 'viewer') {
      setDeployError('Viewers cannot deploy containers in this project.');
      setDeploying(false);
      return;
    }
    try {
      createInstance({
        name: form.name.trim(),
        image,
        project_id: form.project_id,
        project_name: project?.name ?? form.project_id,
        owner_id: user?.id,
      }, accessibleIds);
      setForm(DEFAULT_FORM);
      setUseCustomImage(false);
      setShowModal(false);
      refresh();
    } catch (err) {
      setDeployError(err.message || 'Failed to deploy container.');
    } finally {
      setDeploying(false);
    }
  };

  const handleDelete = (id) => {
    try {
      deleteInstance(id, accessibleIds);
    } catch (err) {
      setDeployError(err.message || 'Failed to delete container.');
    }
    setDeleteId(null);
    refresh();
  };

  const activeProject = filterProject
    ? projects.find((p) => p.id === filterProject)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Containers
            {activeProject && (
              <span className="page-title-sub"> — {activeProject.name}</span>
            )}
          </h1>
          <p className="page-subtitle">Deploy, monitor, and delete your running containers</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Deploy Container
        </button>
      </div>

      <div className="card">
        {instances.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, margin: '0 auto 12px' }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <p>No containers running{activeProject ? ` in ${activeProject.name}` : ''}.</p>
            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>
              Deploy your first container
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Image</th>
                <th>Project</th>
                <th>Status</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Age</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => {
                const proj = projects.find((p) => p.id === inst.project_id);
                const canDelete = proj && proj.role !== 'viewer';
                return (
                  <tr key={inst.id}>
                    <td className="td-name">{inst.name}</td>
                    <td className="td-mono">{inst.image}</td>
                    <td className="td-muted">{inst.project_name}</td>
                    <td><span className="badge badge--green">running</span></td>
                    <td className="td-muted">{inst.cpu}%</td>
                    <td className="td-muted">{inst.memory} MB</td>
                    <td className="td-muted">{timeAgo(inst.created_at)}</td>
                    <td>
                      {!canDelete ? (
                        <span className="td-muted">read-only</span>
                      ) : deleteId === inst.id ? (
                        <span className="delete-confirm">
                          Sure?{' '}
                          <button className="link-btn link-btn--danger" onClick={() => handleDelete(inst.id)}>Yes, delete</button>
                          {' · '}
                          <button className="link-btn" onClick={() => setDeleteId(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button className="btn btn--danger btn--sm" onClick={() => setDeleteId(inst.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal
          title="Deploy Container"
          onClose={() => { setShowModal(false); setDeployError(''); setForm(DEFAULT_FORM); setUseCustomImage(false); }}
        >
          <form onSubmit={handleDeploy}>
            {deployError && <div className="alert alert--error" style={{ marginBottom: 16 }}>{deployError}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="c-name">Container name</label>
              <input
                id="c-name"
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. web-server-1"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Docker image</label>
              <div className="toggle-row">
                <button
                  type="button"
                  className={`toggle-btn${!useCustomImage ? ' toggle-btn--active' : ''}`}
                  onClick={() => setUseCustomImage(false)}
                >
                  Preset
                </button>
                <button
                  type="button"
                  className={`toggle-btn${useCustomImage ? ' toggle-btn--active' : ''}`}
                  onClick={() => setUseCustomImage(true)}
                >
                  Custom
                </button>
              </div>
              {useCustomImage ? (
                <input
                  type="text"
                  className="form-input"
                  style={{ marginTop: 8 }}
                  value={form.customImage}
                  onChange={(e) => setForm({ ...form, customImage: e.target.value })}
                  placeholder="e.g. myregistry/myimage:tag"
                  required={useCustomImage}
                />
              ) : (
                <select
                  className="form-input"
                  style={{ marginTop: 8 }}
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                >
                  {PRESET_IMAGES.map((img) => (
                    <option key={img} value={img}>{img}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="c-project">Project</label>
              {projects.length === 0 ? (
                <p className="form-hint alert alert--warning" style={{ marginTop: 4 }}>
                  You need to create a project first.
                </p>
              ) : (
                <select
                  id="c-project"
                  className="form-input"
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  required
                >
                  <option value="">Select a project…</option>
                  {projects
                    .filter((p) => p.role !== 'viewer')
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => { setShowModal(false); setDeployError(''); setForm(DEFAULT_FORM); setUseCustomImage(false); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={deploying || projects.length === 0}
              >
                {deploying ? 'Deploying…' : 'Deploy'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
