const express = require('express');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const auth    = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const { sub: googleId, email, name } = ticket.getPayload();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        isGoogleUser: true,
        password: Math.random().toString(36).slice(-10), // Random dummy password
        age: 20, // defaults
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.isGoogleUser = true;
      await user.save();
    }

    res.json({ token: sign(user._id), user: user.toSafeObject() });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
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

router.post('/categories', auth, async (req, res) => {
  try {
    const { category } = req.body; // { id, label, icon, color }
    const user = await User.findById(req.user._id);
    user.customCategories.push(category);
    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/categories/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.customCategories = user.customCategories.filter(c => c.id !== req.params.id);
    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
