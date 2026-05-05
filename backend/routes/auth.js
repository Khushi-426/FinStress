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
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one digit')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character'),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    return res.status(400).json({ error: errs.array()[0].msg });
  }
  try {
    if (await User.findOne({ email: req.body.email })) return res.status(400).json({ error: 'Email already registered' });
    
    // Hashing is handled in User model pre-save hook using bcryptjs
    const user = await User.create(req.body);
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
    const catId = req.params.id;
    
    // If it's a custom category, remove it
    const isCustom = user.customCategories.some(c => c.id === catId);
    if (isCustom) {
      user.customCategories = user.customCategories.filter(c => c.id !== catId);
    } else {
      // If it's a default category, hide it
      if (!user.hiddenCategories.includes(catId)) {
        user.hiddenCategories.push(catId);
      }
    }
    
    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories/restore', auth, async (req, res) => {
  try {
    const { catId } = req.body;
    const user = await User.findById(req.user._id);
    user.hiddenCategories = user.hiddenCategories.filter(id => id !== catId);
    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
