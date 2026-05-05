const express = require('express');
const auth    = require('../middleware/auth');
const Expense = require('../models/Expense');

const router = express.Router();

// POST /api/expenses — add one entry
router.post('/', auth, async (req, res) => {
  try {
    const { date, category, amount, note, isRecurring, type } = req.body;
    if (!category || amount == null) return res.status(400).json({ error: 'category and amount required' });
    const exp = await Expense.create({ userId: req.user._id, date: date || Date.now(), category, amount: +amount, note, isRecurring, type: type || 'expense' });
    res.status(201).json(exp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/expenses?month=2024-03&category=food
router.get('/', auth, async (req, res) => {
  try {
    const { month, category, limit = 100 } = req.query;
    const filter = { userId: req.user._id };
    if (month) {
      const [y, m] = month.split('-');
      filter.date = {
        $gte: new Date(+y, +m - 1, 1),
        $lt:  new Date(+y, +m, 1),
      };
    }
    if (category) filter.category = category;
    const items = await Expense.find(filter).sort({ date: -1 }).limit(+limit);
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/expenses/summary?month=2024-03 — aggregated totals by category
router.get('/summary', auth, async (req, res) => {
  try {
    const { month } = req.query;
    const [y, m] = (month || new Date().toISOString().slice(0,7)).split('-');
    const start = new Date(+y, +m - 1, 1);
    const end   = new Date(+y, +m, 1);

    const agg = await Expense.aggregate([
      { $match: { userId: req.user._id, date: { $gte: start, $lt: end } } },
      { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const byCategory = {};
    let totalIncome = 0, totalExpenses = 0;
    agg.forEach(({ _id, total }) => {
      if (_id.type === 'income' || _id.category === 'income' || _id.category === 'financial_aid') {
        totalIncome += total;
      } else {
        totalExpenses += total;
      }
      byCategory[_id.category] = (byCategory[_id.category] || 0) + total;
    });

    res.json({ month, totalIncome, totalExpenses, savingsGap: totalIncome - totalExpenses, byCategory });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/expenses/daily?month=2024-03 — day-by-day spending for chart
router.get('/daily', auth, async (req, res) => {
  try {
    const { month } = req.query;
    const [y, m] = (month || new Date().toISOString().slice(0,7)).split('-');
    const start = new Date(+y, +m - 1, 1);
    const end   = new Date(+y, +m, 1);

    const agg = await Expense.aggregate([
      { $match: { userId: req.user._id, date: { $gte: start, $lt: end }, type: 'expense' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(agg.map(d => ({ date: d._id, total: d.total })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/expenses/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const exp = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body, { new: true }
    );
    if (!exp) return res.status(404).json({ error: 'Not found' });
    res.json(exp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/expenses/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Expense.deleteOne({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
