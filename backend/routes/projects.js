const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { supabase } = require('../config/db');
const auth = require('../middleware/auth');
const router = express.Router();

const validateId = param('id').isUUID().withMessage('Invalid project ID');

// @route GET /project
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description, owner_id, status, created_at')
      .eq('owner_id', req.user.id)
      .eq('status', 'active');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get projects error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route GET /project/:id
router.get('/:id', [auth, validateId], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description, owner_id, status, created_at')
      .eq('id', id)
      .eq('owner_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(data);
  } catch (err) {
    console.error('Get project by ID error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route POST /project
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

    try {
      // Duplicate check
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('name', name)
        .eq('owner_id', ownerId)
        .eq('status', 'active');

      if (existing && existing.length > 0) {
        return res.status(409).json({
          error: 'Project name already exists',
          message: `You already have a project named '${name}'.`,
        });
      }

      const { data: created, error } = await supabase
        .from('projects')
        .insert({ name, description, owner_id: ownerId, status: 'active' })
        .select('id, name, description, owner_id, status, created_at');

      if (error) throw error;

      return res.status(201).json({
        message: 'Project created successfully',
        project: created[0],
      });
    } catch (err) {
      console.error('Create project error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// @route PUT /project/:id
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
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const ownerId = req.user.id;

    try {
      // Check project exists and belongs to user
      const { data: existing } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('owner_id', ownerId)
        .eq('status', 'active')
        .single();

      if (!existing) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { name, description } = req.body;

      // If renaming, check for duplicate
      if (name && name !== existing.name) {
        const { data: duplicate } = await supabase
          .from('projects')
          .select('id')
          .eq('name', name)
          .eq('owner_id', ownerId)
          .eq('status', 'active')
          .neq('id', id);

        if (duplicate && duplicate.length > 0) {
          return res.status(409).json({
            error: 'Project name already exists',
            message: `You already have a project named '${name}'.`,
          });
        }
      }

      // Build update object with only provided fields
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;

      const { data: updated, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select('id, name, description, owner_id, status, created_at');

      if (error) throw error;

      return res.json({
        message: 'Project updated successfully',
        project: updated[0],
      });
    } catch (err) {
      console.error('Update project error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// @route DELETE /project/:id
router.delete('/:id', [auth, validateId], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const { id } = req.params;
  const ownerId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('projects')
      .update({ status: 'deleted' })
      .eq('id', id)
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Delete project error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
