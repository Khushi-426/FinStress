const express = require('express');
const auth    = require('../middleware/auth');
const SavingsGoal = require('../models/SavingsGoal');
const router = express.Router();

// GET all goals
router.get('/', auth, async (req, res) => {
  try {
    const goals = await SavingsGoal.find({ userId: req.user._id }).active().sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST new goal
router.post('/', auth, async (req, res) => {
  try {
    const goal = await SavingsGoal.create({ ...req.body, userId: req.user._id });
    res.status(201).json(goal);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH goal (e.g. update currentAmount)
router.patch('/:id', auth, async (req, res) => {
  try {
    const goal = await SavingsGoal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json(goal);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE goal (soft)
router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await SavingsGoal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { deletedAt: new Date() },
      { new: true }
    );
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
