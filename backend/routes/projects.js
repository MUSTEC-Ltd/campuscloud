const express = require('express');
const supabase = require('../config/db'); // Updated import
const auth = require('../middleware/auth');
const router = express.Router();

// @route GET /project
// @desc Get all projects for logged in user
router.get('/', auth, async (req, res) => {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', req.user.id);

    if (error) throw error;
    res.json(projects);
  } catch (err) {
    console.error('Get projects error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
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

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert([{ name, owner_id: req.user.id }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newProject);
  } catch (err) {
    console.error('Create project error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
