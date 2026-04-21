const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const auth = require('../middleware/auth');
const { requireProjectRole } = require('../middleware/projectAccess');
const router = express.Router();

const validateId = param('id').isUUID().withMessage('Invalid project ID');
const PROJECT_COLS = 'p.id, p.name, p.description, p.owner_id, p.status, p.created_at';

// List projects the caller is a member of (any role)
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${PROJECT_COLS}, m.role
       FROM projects p
       JOIN project_members m ON m.project_id = p.id AND m.user_id = $1
       WHERE p.status = 'active'
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get projects error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Read a single project — viewer or higher
router.get('/:id', [auth, validateId, requireProjectRole('viewer')], (req, res) => {
  res.json(req.project);
});

// Create a project — auth only; creator becomes owner
router.post(
  '/',
  [
    auth,
    body('name')
      .trim()
      .notEmpty().withMessage('Project name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Project name must be 2-50 characters')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Project name can only contain letters, numbers, underscores, and hyphens'),
    body('description')
      .optional()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { name, description = '' } = req.body;
    const ownerId = req.user.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id FROM projects WHERE name = $1 AND owner_id = $2 AND status = 'active'`,
        [name, ownerId]
      );
      if (existing.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Project name already exists',
          message: `You already have a project named '${name}'.`,
        });
      }

      const created = await client.query(
        `INSERT INTO projects (name, description, owner_id, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id, name, description, owner_id, status, created_at`,
        [name, description, ownerId]
      );
      const project = created.rows[0];

      await client.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [project.id, ownerId]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        message: 'Project created successfully',
        project: { ...project, role: 'owner' },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create project error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// Update a project — editor or higher
router.put(
  '/:id',
  [
    auth,
    validateId,
    requireProjectRole('editor'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Project name must be 2-50 characters')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Project name can only contain letters, numbers, underscores, and hyphens'),
    body('description')
      .optional()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const project = req.project;
    const { name, description } = req.body;

    try {
      if (name && name !== project.name) {
        const dup = await pool.query(
          `SELECT id FROM projects WHERE name = $1 AND owner_id = $2 AND status = 'active' AND id <> $3`,
          [name, project.owner_id, project.id]
        );
        if (dup.rowCount > 0) {
          return res.status(409).json({
            error: 'Project name already exists',
            message: `A project named '${name}' already exists for this owner.`,
          });
        }
      }

      const sets = [];
      const values = [];
      let idx = 1;
      if (name !== undefined) { sets.push(`name = $${idx++}`); values.push(name); }
      if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description); }

      if (sets.length === 0) {
        return res.json({ message: 'Project updated successfully', project });
      }

      values.push(project.id);
      const updated = await pool.query(
        `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, description, owner_id, status, created_at`,
        values
      );

      return res.json({
        message: 'Project updated successfully',
        project: { ...updated.rows[0], role: project.role },
      });
    } catch (err) {
      console.error('Update project error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete (soft) — owner only
router.delete('/:id', [auth, validateId, requireProjectRole('owner')], async (req, res) => {
  try {
    await pool.query(
      `UPDATE projects SET status = 'deleted' WHERE id = $1`,
      [req.project.id]
    );
    return res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Delete project error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ----- Member management -----

router.get('/:id/members', [auth, validateId, requireProjectRole('viewer')], async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.user_id, u.email, m.role, m.added_at
       FROM project_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.project_id = $1
       ORDER BY m.added_at ASC`,
      [req.project.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List members error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post(
  '/:id/members',
  [
    auth,
    validateId,
    requireProjectRole('owner'),
    body('email').isEmail().withMessage('Valid email required'),
    body('role').isIn(['viewer', 'editor']).withMessage("Role must be 'viewer' or 'editor'"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { email, role } = req.body;
    try {
      const userRes = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
      if (userRes.rowCount === 0) {
        return res.status(404).json({ error: 'User not registered' });
      }
      const targetUser = userRes.rows[0];

      if (targetUser.id === req.project.owner_id) {
        return res.status(409).json({ error: "Cannot change the project owner's role here" });
      }

      const upserted = await pool.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
         RETURNING user_id, role, added_at`,
        [req.project.id, targetUser.id, role]
      );

      return res.status(201).json({
        message: 'Member added',
        member: { ...upserted.rows[0], email: targetUser.email },
      });
    } catch (err) {
      console.error('Add member error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete(
  '/:id/members/:userId',
  [
    auth,
    validateId,
    param('userId').isUUID().withMessage('Invalid user ID'),
    requireProjectRole('owner'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { userId } = req.params;

    try {
      const target = await pool.query(
        `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
        [req.project.id, userId]
      );
      if (target.rowCount === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }

      if (target.rows[0].role === 'owner') {
        const owners = await pool.query(
          `SELECT COUNT(*)::int AS n FROM project_members WHERE project_id = $1 AND role = 'owner'`,
          [req.project.id]
        );
        if (owners.rows[0].n <= 1) {
          return res.status(409).json({ error: 'Cannot remove the last owner' });
        }
      }

      await pool.query(
        `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
        [req.project.id, userId]
      );
      return res.json({ message: 'Member removed' });
    } catch (err) {
      console.error('Remove member error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
