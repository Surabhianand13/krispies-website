'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db        = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Limit login attempts to 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username required.'),
    body('password').notEmpty().withMessage('Password required.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ token, username: user.username });
  }
);

// GET /api/auth/me  — verify token still valid
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

// POST /api/auth/change-password
router.post('/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty().withMessage('Current password required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(req.body.currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = bcrypt.hashSync(req.body.newPassword, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, user.id);
    res.json({ message: 'Password updated.' });
  }
);

module.exports = router;
