import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { getProjectMembers, addProjectMember, removeProjectMember } from '../api/projects';

export default function MembersModal({ project, onClose }) {
  const { token } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [busy, setBusy] = useState(false);

  const canManage = project.role === 'owner';

  const load = async () => {
    setErr('');
    try {
      setMembers(await getProjectMembers(project.id, token));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setMembers([]);
    setErr('');
    setLoading(true);
    (async () => {
      try {
        const next = await getProjectMembers(project.id, token);
        if (active) setMembers(next);
      } catch (e) {
        if (active) setErr(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [project.id, token]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await addProjectMember(project.id, { email: email.trim(), role }, token);
      setEmail('');
      setRole('viewer');
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId) => {
    setBusy(true);
    setErr('');
    try {
      await removeProjectMember(project.id, userId, token);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (memberEmail, newRole) => {
    setBusy(true);
    setErr('');
    try {
      await addProjectMember(project.id, { email: memberEmail, role: newRole }, token);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Members — ${project.name}`} onClose={onClose}>
      {err && <div className="alert alert--error" style={{ marginBottom: 16 }}>{err}</div>}

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : (
        <table className="data-table" style={{ marginBottom: 16 }}>
          <thead>
            <tr><th>Email</th><th>Role</th>{canManage && <th></th>}</tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td className="td-name">{m.email}</td>
                <td>
                  {canManage && m.role !== 'owner' ? (
                    <select
                      className="form-input"
                      style={{ padding: '4px 8px', height: 'auto' }}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => handleRoleChange(m.email, e.target.value)}
                    >
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                    </select>
                  ) : (
                    <span className={`badge ${m.role === 'owner' ? 'badge--green' : 'badge--gray'}`}>{m.role}</span>
                  )}
                </td>
                {canManage && (
                  <td>
                    {m.role === 'owner' ? (
                      <span className="td-muted">—</span>
                    ) : (
                      <button
                        className="btn btn--danger btn--sm"
                        disabled={busy}
                        onClick={() => handleRemove(m.user_id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleAdd}>
          <div className="form-group">
            <label className="form-label" htmlFor="m-email">Invite by email</label>
            <input
              id="m-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@gmail.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="m-role">Role</label>
            <select
              id="m-role"
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="viewer">viewer (read-only)</option>
              <option value="editor">editor (can update)</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Working…' : 'Add member'}
            </button>
          </div>
        </form>
      )}

      {!canManage && (
        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      )}
    </Modal>
  );
}
