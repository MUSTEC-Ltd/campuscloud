const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../config/db');
const auth = require('../middleware/auth');
const router = express.Router();

const validateId = param('id').isUUID().withMessage('Invalid project ID');

// @route GET /project
// @desc Get all projects for logged in user
router.get('/', auth, async (req, res) => {
  try {
    const projectsRes = await db.query(
      "SELECT id, name, description, owner_id, status, created_at FROM projects WHERE owner_id = $1 AND status = 'active'",
      [req.user.id]
    );
    res.json(projectsRes.rows);
  } catch (err) {
    console.error('Get projects error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route GET /project/:id
// @desc Get a single project by ID
router.get('/:id', [auth, validateId], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const { id } = req.params;
  const ownerId = req.user.id;

  try {
    const projectRes = await db.query(
      "SELECT id, name, description, owner_id, status, created_at FROM projects WHERE id = $1 AND owner_id = $2 AND status = 'active'",
      [id, ownerId]
    );
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(projectRes.rows[0]);
  } catch (err) {
    console.error('Get project by ID error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route POST /project
// @desc Create a new project
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
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { name, description = '' } = req.body;
    const ownerId = req.user.id;

    try {
      // Duplicate check — same name + owner with active status
      const existing = await db.query(
        "SELECT id FROM projects WHERE name = $1 AND owner_id = $2 AND status = 'active'",
        [name, ownerId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Project name already exists',
          message: `You already have a project named '${name}'.`,
        });
      }

      const projectRes = await db.query(
        `INSERT INTO projects (name, description, owner_id, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id, name, description, owner_id, status, created_at`,
        [name, description, ownerId]
      );

      return res.status(201).json({
        message: 'Project created successfully',
        project: projectRes.rows[0],
      });
    } catch (err) {
      console.error('Create project error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// @route PUT /project/:id
// @desc Update a project (name and/or description)
router.put(
  '/:id',
  [
    auth,
    validateId,
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
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { id } = req.params;
    const ownerId = req.user.id;

    try {
      // Check project exists and belongs to user
      const projectRes = await db.query(
        "SELECT * FROM projects WHERE id = $1 AND owner_id = $2 AND status = 'active'",
        [id, ownerId]
      );
      if (projectRes.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { name, description } = req.body;

      // If renaming, check duplicate
      if (name && name !== projectRes.rows[0].name) {
        const duplicate = await db.query(
          "SELECT id FROM projects WHERE name = $1 AND owner_id = $2 AND status = 'active' AND id != $3",
          [name, ownerId, id]
        );
        if (duplicate.rows.length > 0) {
          return res.status(409).json({
            error: 'Project name already exists',
            message: `You already have a project named '${name}'.`,
          });
        }
      }

      const updated = await db.query(
        `UPDATE projects
         SET name = COALESCE($1, name), description = COALESCE($2, description)
         WHERE id = $3 AND owner_id = $4
         RETURNING id, name, description, owner_id, status, created_at`,
        [name || null, description !== undefined ? description : null, id, ownerId]
      );

      return res.json({
        message: 'Project updated successfully',
        project: updated.rows[0],
      });
    } catch (err) {
      console.error('Update project error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// @route DELETE /project/:id
// @desc Delete a project (soft delete — sets status to 'deleted')
router.delete('/:id', [auth, validateId], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const { id } = req.params;
  const ownerId = req.user.id;

  try {
    const projectRes = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND owner_id = $2 AND status = 'active'",
      [id, ownerId]
    );
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db.query(
      "UPDATE projects SET status = 'deleted' WHERE id = $1",
      [id]
    );

    return res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Delete project error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
