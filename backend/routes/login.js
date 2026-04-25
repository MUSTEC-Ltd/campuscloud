const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { generateTokens, setRefreshCookie, JWT_SECRET } = require('../utils/tokens');
const router = express.Router();

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
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const { accessToken, refreshToken } = await generateTokens(user);
      setRefreshCookie(res, refreshToken);

      res.json({
        accessToken,
        user: { id: user.id, email: user.email },
      });
    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Refresh access token using the HttpOnly refresh token cookie
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const result = await pool.query(
      `SELECT rt.user_id, u.email
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    if (result.rowCount === 0) {
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const { user_id, email } = result.rows[0];
    const accessToken = jwt.sign({ id: user_id, email }, JWT_SECRET, { expiresIn: '15m' });

    res.json({ accessToken });
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
