const express = require('express');
const auth   = require('../middleware/auth');
const Budget = require('../models/Budget');

const router = express.Router();

// GET /api/budget?month=2024-03
router.get('/', auth, async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0,7);
    let budget = await Budget.findOne({ userId: req.user._id, month });
    if (!budget) budget = { month, targets: {}, monthlyIncome: 0, financialAid: 0 };
    res.json(budget);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/budget — upsert month budget
router.put('/', auth, async (req, res) => {
  try {
    const { month, targets, monthlyIncome, financialAid } = req.body;
    const budget = await Budget.findOneAndUpdate(
      { userId: req.user._id, month },
      { targets, monthlyIncome, financialAid },
      { upsert: true, new: true }
    );
    res.json(budget);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
