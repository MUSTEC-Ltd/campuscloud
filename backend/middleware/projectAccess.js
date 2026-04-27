const supabase = require('../config/db'); // Using your Phase 1 Supabase connection

const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireProjectRole(minRole) {
  return async (req, res, next) => {
    const projectId = req.params.id || req.body?.project_id || req.query?.project_id;
    
    if (!projectId) return res.status(400).json({ error: 'project_id is required' });
    if (!UUID_RE.test(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    try {
      // Assuming a simplified schema based on Phase 1 where the project has an owner_id
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error || !project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if the current user is the owner (Rank 3)
      // Note: Expand this logic if your database schema officially implemented the 'project_members' table
      const userRole = project.owner_id === req.user.id ? 'owner' : 'viewer';

      if (ROLE_RANK[userRole] < ROLE_RANK[minRole]) {
        return res.status(403).json({
          error: 'Insufficient permission',
          required: minRole,
          actual: userRole,
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