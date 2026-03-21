const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/db'); // Updated import
const router = express.Router();

// Helper to generate tokens
const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const { error } = await supabase
    .from('refresh_tokens')
    .insert([{ token: refreshToken, user_id: user.id, expires_at: expiresAt.toISOString() }]);
  
  if (error) throw error;

  return { accessToken, refreshToken };
};

// @route POST /login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').exists().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg,
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    try {
      // Check user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (userError || !user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Validate password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const { accessToken, refreshToken } = await generateTokens(user);

      // Set cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        accessToken,
        user: { id: user.id, email: user.email },
      });
    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route POST /logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    // Delete from Supabase
    await supabase.from('refresh_tokens').delete().eq('token', refreshToken);
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
