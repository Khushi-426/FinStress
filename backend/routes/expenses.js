const express = require('express');
const auth    = require('../middleware/auth');
const Expense = require('../models/Expense');
const Budget  = require('../models/Budget');
const cache   = require('../config/cache');
const { body, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

const router = express.Router();

// POST /api/expenses — add one entry
router.post('/', auth, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('category').notEmpty().withMessage('Category is required'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('note').optional().trim()
    .customSanitizer(v => DOMPurify.sanitize(v))
    .isLength({ max: 200 }).withMessage('Note max 200 chars'),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
  
  try {
    const { date, category, amount, note, isRecurring, type } = req.body;
    const exp = await Expense.create({ 
      userId: req.user._id, 
      date: date || Date.now(), 
      category, 
      amount: Math.round(+amount * 100) / 100, // Store as decimal
      note, 
      isRecurring: !!isRecurring, 
      type: type || 'expense' 
    });
    
    // Invalidate cache for this month
    const mStr = (date || new Date().toISOString()).slice(0, 7);
    cache.del(`summary:${req.user._id}:${mStr}`);

    // CHECK BUDGET ALERT
    let alert = null;
    if (type !== 'income') {
      const [y, m] = mStr.split('-');
      const start = new Date(+y, +m - 1, 1);
      const end   = new Date(+y, +m, 1);

      const [budget, currentAgg] = await Promise.all([
        Budget.findOne({ userId: req.user._id, month: mStr }),
        Expense.aggregate([
          { $match: { userId: req.user._id, category, date: { $gte: start, $lt: end }, deletedAt: null } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);

      const target = budget?.targets?.[category];
      const currentTotal = currentAgg[0]?.total || 0;

      if (target > 0 && currentTotal > target) {
        alert = {
          type: 'over_budget',
          category,
          message: `Warning: You have exceeded your ₹${target} budget for ${category.replace('_',' ')}!`
        };
      }
    }
    
    res.status(201).json({ ...exp.toObject(), alert });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/expenses?month=2024-03&category=food&limit=50&skip=0
router.get('/', auth, async (req, res) => {
  try {
    const { month, category, limit = 50, skip = 0 } = req.query;
    const filter = { userId: req.user._id };
    if (month) {
      const [y, m] = month.split('-');
      filter.date = {
        $gte: new Date(+y, +m - 1, 1),
        $lt:  new Date(+y, +m, 1),
      };
    }
    if (category) filter.category = String(category);
    
    const [items, total] = await Promise.all([
      Expense.find(filter)
        .active()
        .select('date category amount note isRecurring type')
        .sort({ date: -1 })
        .limit(Math.min(parseInt(limit), 100)) // Cap at 100
        .skip(parseInt(skip))
        .lean(),
      Expense.countDocuments({ ...filter, deletedAt: null })
    ]);
    
    res.json({ items, total, limit: parseInt(limit), skip: parseInt(skip) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/expenses/summary?month=2024-03 — aggregated totals by category
router.get('/summary', auth, async (req, res) => {
  try {
    const { month } = req.query;
    const mStr = month || new Date().toISOString().slice(0, 7);
    const cacheKey = `summary:${req.user._id}:${mStr}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [y, m] = mStr.split('-');
    const start = new Date(+y, +m - 1, 1);
    const end   = new Date(+y, +m, 1);
    const pStart = new Date(+y, +m - 2, 1);
    const pEnd   = new Date(+y, +m - 1, 1);

    const [agg, prevAgg] = await Promise.all([
      Expense.aggregate([
        { $match: { userId: req.user._id, date: { $gte: start, $lt: end }, deletedAt: null } },
        { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { userId: req.user._id, date: { $gte: pStart, $lt: pEnd }, deletedAt: null } },
        { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' } } },
      ])
    ]);

    const process = (data) => {
      const cats = {};
      let inc = 0, exp = 0;
      data.forEach(({ _id, total }) => {
        if (_id.type === 'income' || _id.category === 'income' || _id.category === 'financial_aid') inc += total;
        else exp += total;
        cats[_id.category] = (cats[_id.category] || 0) + total;
      });
      return { cats, inc, exp };
    };

    const current = process(agg);
    const previous = process(prevAgg);

    const comparison = {};
    const allCats = new Set([...Object.keys(current.cats), ...Object.keys(previous.cats)]);
    allCats.forEach(cat => {
      const cur = current.cats[cat] || 0;
      const prev = previous.cats[cat] || 0;
      if (prev === 0 && cur > 0) comparison[cat] = 100;
      else if (prev > 0 && cur === 0) comparison[cat] = -100;
      else if (prev > 0) comparison[cat] = Math.round(((cur - prev) / prev) * 100);
      else comparison[cat] = 0;
    });

    const result = { 
      month: mStr,
      totalIncome: current.inc,
      totalExpenses: current.exp,
      savingsGap: current.inc - current.exp,
      byCategory: current.cats,
      comparison,
      prevTotals: { income: previous.inc, expenses: previous.exp }
    };
    
    cache.set(cacheKey, result);
    res.json(result);
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
      { $match: { userId: req.user._id, date: { $gte: start, $lt: end }, type: 'expense', deletedAt: null } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(agg.map(d => ({ date: d._id, total: d.total })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/expenses/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    if (req.body.amount && (isNaN(req.body.amount) || +req.body.amount <= 0)) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    const exp = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body.amount ? { ...req.body, amount: Math.round(+req.body.amount * 100) / 100 } : req.body, 
      { new: true }
    );
    if (!exp) return res.status(404).json({ error: 'Not found' });
    
    // Invalidate cache
    const mStr = exp.date.toISOString().slice(0, 7);
    cache.del(`summary:${req.user._id}:${mStr}`);
    
    res.json(exp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/expenses/:id — soft delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const exp = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { deletedAt: new Date(), deletedBy: req.user._id },
      { new: true }
    );
    if (!exp) return res.status(404).json({ error: 'Not found' });
    
    // Invalidate cache
    const mStr = exp.date.toISOString().slice(0, 7);
    cache.del(`summary:${req.user._id}:${mStr}`);
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/expenses/export?month=2024-03 — CSV Export
router.get('/export', auth, async (req, res) => {
  try {
    const { month } = req.query;
    const filter = { userId: req.user._id, deletedAt: null };
    if (month) {
      const [y, m] = month.split('-');
      filter.date = {
        $gte: new Date(+y, +m - 1, 1),
        $lt:  new Date(+y, +m, 1),
      };
    }

    const items = await Expense.find(filter).sort({ date: -1 }).lean();
    
    // Create CSV header
    let csv = 'Date,Category,Type,Amount,Note,Is Recurring\n';
    
    // Add rows
    items.forEach(e => {
      const dateStr = new Date(e.date).toISOString().split('T')[0];
      const note = (e.note || '').replace(/,/g, ';'); // Escape commas
      csv += `${dateStr},${e.category},${e.type},${e.amount},${note},${e.isRecurring ? 'Yes' : 'No'}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=finstress-export-${month || 'all'}.csv`);
    res.status(200).send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
