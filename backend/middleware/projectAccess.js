const { pool } = require('../config/db');

const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireProjectRole(minRole) {
  return async (req, res, next) => {
    const projectId =
      req.params.id || req.body?.project_id || req.query?.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    if (!UUID_RE.test(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    try {
      const result = await pool.query(
        `SELECT p.id, p.name, p.description, p.owner_id, p.status, p.created_at, m.role
         FROM projects p
         JOIN project_members m ON m.project_id = p.id AND m.user_id = $2
         WHERE p.id = $1 AND p.status = 'active'`,
        [projectId, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = result.rows[0];
      if (ROLE_RANK[project.role] < ROLE_RANK[minRole]) {
        return res.status(403).json({
          error: 'Insufficient permission',
          required: minRole,
          actual: project.role,
        });
      }

      req.project = project;
      next();
    } catch (err) {
      console.error('projectAccess error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = { requireProjectRole, ROLE_RANK };
