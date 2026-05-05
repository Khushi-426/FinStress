const express = require('express');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const auth    = require('../middleware/auth');

const router = express.Router();
const sign   = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

router.post('/register', [
  body('name').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    if (await User.findOne({ email: req.body.email })) return res.status(400).json({ error: 'Email already registered' });
    const user  = await User.create(req.body);
    res.status(201).json({ token: sign(user._id), user: user.toSafeObject() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: sign(user._id), user: user.toSafeObject() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

router.patch('/profile', auth, async (req, res) => {
  try {
    const allowed = ['name','age','gender','yearInSchool','major','paymentMethod'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
