const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const router = express.Router();

// @route GET /projects
// @desc Get all projects for logged in user
router.get('/', auth, async (req, res) => {
  try {
    const projectsRes = await db.query(
      'SELECT * FROM projects WHERE owner_id = $1',
      [req.user.id]
    );
    res.json(projectsRes.rows);
  } catch (err) {
    console.error('Get projects error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route POST /project
// @desc Create a new project
router.post('/', auth, async (req, res) => {
  const { name } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const insertRes = await db.query(
      'INSERT INTO projects (name, owner_id) VALUES ($1, $2) RETURNING *',
      [name, req.user.id]
    );

    const newProject = insertRes.rows[0];
    res.status(201).json(newProject);
  } catch (err) {
    console.error('Create project error:', err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
