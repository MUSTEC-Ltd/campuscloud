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

  // Store refresh token in Supabase
  const { error } = await supabase
    .from('refresh_tokens')
    .insert([{ token: refreshToken, user_id: user.id, expires_at: expiresAt.toISOString() }]);
  
  if (error) throw error;

  return { accessToken, refreshToken };
};

// @route POST /register
router.post(
  '/register',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .custom((value) => {
        if (!value.endsWith('@gmail.com') && !value.match(/\.edu$/)) {
          throw new Error('Email must be a @gmail.com or @*.edu address');
        }
        return true;
      }),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),
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
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle(); // Returns null if no user is found

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ email, password: hashedPassword }])
        .select('id, email')
        .single();

      if (insertError) throw insertError;
      const { accessToken, refreshToken } = await generateTokens(newUser);

      // Set cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        message: 'User registered successfully',
        accessToken,
        user: { id: newUser.id, email: newUser.email },
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

module.exports = router;
