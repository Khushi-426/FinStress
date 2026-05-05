const express  = require('express');
const axios    = require('axios');
const auth     = require('../middleware/auth');
const Expense  = require('../models/Expense');
const Budget   = require('../models/Budget');
const Analysis = require('../models/Analysis');
const logger   = require('../config/logger');

const router  = express.Router();
if (!process.env.ML_SERVICE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('ML_SERVICE_URL env var is required in production');
}
const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const PEER = {
  Freshman:  { avgStress:67.1, avgIncome:1561, avgExpenses:2189 },
  Sophomore: { avgStress:69.4, avgIncome:1491, avgExpenses:2138 },
  Junior:    { avgStress:68.7, avgIncome:1521, avgExpenses:2172 },
  Senior:    { avgStress:69.7, avgIncome:1527, avgExpenses:2188 },
};

function buildSuggestions(snap, ml, user) {
  const sugs = [];
  const { byCategory, totalIncome, totalExpenses, savingsGap, discretionaryRatio } = snap;
  const targets = snap.targets || {};

  // Student Monthly Benchmarks (approximate in ₹)
  const BENCHMARKS = {
    food: 6000,
    transportation: 3000,
    entertainment: 2500,
    personal_care: 2000,
    technology: 3000,
    miscellaneous: 2000
  };

  // 1. Budget Overages (High Priority)
  Object.keys(targets || {}).forEach(cat => {
    const actual = byCategory[cat] || 0;
    const target = targets[cat] || 0;
    if (target > 0 && actual > target) {
      const diff = actual - target;
      const displayCat = cat.replace('_', ' ');
      sugs.push({
        category: cat,
        severity: 'danger',
        title: `Over Budget: ${displayCat}`,
        text: `You exceeded your ${displayCat} target by ₹${Math.round(diff)}. To lower your stress, try capping this category next month.`,
        potential: Math.round(diff),
        impact: 'High'
      });
    }
  });

  // 2. High Discretionary Spend
  if (discretionaryRatio > 0.3) {
    const waste = Math.round((discretionaryRatio - 0.2) * (totalIncome || 1));
    sugs.push({
      category: 'discretionary',
      severity: 'warn',
      title: 'High Non-Essential Spending',
      text: `${Math.round(discretionaryRatio * 100)}% of your income goes to non-essentials. Reducing this to 20% would save you approx ₹${waste} and significantly lower your stress score.`,
      potential: waste,
      impact: 'Medium'
    });
  }

  // 3. Category-Specific Advice (Benchmarked)
  if ((byCategory.food || 0) > BENCHMARKS.food) {
    sugs.push({
      category: 'food',
      severity: 'warn',
      title: 'Optimization: Food & Dining',
      text: `Your food spending (₹${Math.round(byCategory.food)}) is above the typical student average. Meal prepping just 3 days a week can reduce dining costs by up to 30%.`,
      potential: Math.round(byCategory.food * 0.3),
      impact: 'Medium'
    });
  }

  if ((byCategory.transportation || 0) > BENCHMARKS.transportation) {
    sugs.push({
      category: 'transportation',
      severity: 'warn',
      title: 'Commute Efficiency',
      text: `Transportation costs are high. Consider student transit passes or carpooling to save roughly ₹${Math.round(byCategory.transportation * 0.2)} monthly.`,
      potential: Math.round(byCategory.transportation * 0.2),
      impact: 'Low'
    });
  }

  if ((byCategory.technology || 0) > BENCHMARKS.technology) {
    sugs.push({
      category: 'technology',
      severity: 'warn',
      title: 'Subscription Audit',
      text: `Tech spending detected. Audit your active subscriptions for unused services or switch to 'Student Tiers' where available.`,
      potential: 500,
      impact: 'Medium'
    });
  }

  // 4. Savings Gap Advice
  if (savingsGap < 0) {
    sugs.push({
      category: 'budget',
      severity: 'danger',
      title: 'Critical: Living Above Means',
      text: `You are running a ₹${Math.abs(Math.round(savingsGap))} deficit. This is a major stress driver. We recommend a "no-spend" week on non-essentials to bridge this gap immediately.`,
      potential: Math.abs(Math.round(savingsGap)),
      impact: 'Critical'
    });
  } else if (savingsGap > 5000 && ml.ensembleScore < 40) {
    sugs.push({
      category: 'savings',
      severity: 'good',
      title: 'Resilience Strategy: Surplus detected',
      text: `Great work! You have a ₹${Math.round(savingsGap)} surplus. Move ₹${Math.round(savingsGap * 0.4)} to an emergency fund to build long-term financial resilience.`,
      potential: 0,
      impact: 'High'
    });
  }

  // Ensure at least one suggestion
  if (sugs.length === 0) {
    sugs.push({
      category: 'general',
      severity: 'good',
      title: 'Financial Health Maintained',
      text: 'You are managing your budget exceptionally well. Continue this discipline to maintain your low stress level.',
      potential: 0,
      impact: 'Low'
    });
  }

  // Sort by potential savings descending
  return sugs.sort((a, b) => b.potential - a.potential);
}

// POST /api/analysis/run?month=2024-03
router.post('/run', auth, async (req, res) => {
  try {
    const month = req.body.month || new Date().toISOString().slice(0,7);
    const [y, m] = month.split('-');
    const start  = new Date(+y, +m - 1, 1);
    const end    = new Date(+y, +m, 1);
    const user   = req.user;
    logger.info('Analysis run started', { userId: user._id, month });

    const session = await Expense.startSession();
    session.startTransaction();

    try {
      // Optimized single aggregation pipeline
      const agg = await Expense.aggregate([
        { $match: { userId: user._id, date: { $gte: start, $lt: end }, deletedAt: null } },
        {
          $facet: {
            byCategory: [
              { $group: { _id: '$category', total: { $sum: '$amount' } } }
            ],
            byType: [
              { $group: { _id: '$type', total: { $sum: '$amount' } } }
            ]
          }
        }
      ]).session(session);

      const facets = agg[0];
      const byCategory = {};
      facets.byCategory.forEach(c => byCategory[c._id] = c.total);
      
      let totalIncome = 0;
      facets.byType.forEach(t => {
        if (t._id === 'income') totalIncome = t.total;
      });
      // Fallback for income in custom categories
      if (byCategory.income) totalIncome = Math.max(totalIncome, byCategory.income);
      if (byCategory.financial_aid) totalIncome += (byCategory.financial_aid || 0);

      // Pull budget for targets and fallback income
      const budget = await Budget.findOne({ userId: user._id, month }).session(session);
      let targets = budget?.targets || {};

      // DEFENSIVE: Ensure targets is an object and initialized
      if (!targets || typeof targets !== 'object') {
        targets = {};
        Object.keys(byCategory).forEach(cat => {
          if (!targets[cat]) targets[cat] = 0;
        });
      }

      // Combine Budget income (base) with Tracked income (extra/random)
      const budgetIncome = (budget?.monthlyIncome || 0) + (budget?.financialAid || 0);
      const trackedIncome = totalIncome; 
      const finalIncome = budgetIncome + trackedIncome;

      const tuitionMonthly    = (byCategory.tuition||0);
      const housing           = byCategory.housing||0;
      const food              = byCategory.food||0;
      const transportation    = byCategory.transportation||0;
      const booksSupplies     = byCategory.books_supplies||0;
      const entertainment     = byCategory.entertainment||0;
      const personalCare      = byCategory.personal_care||0;
      const technology        = byCategory.technology||0;
      const healthWellness    = byCategory.health_wellness||0;
      const miscellaneous     = byCategory.miscellaneous||0;

      const totalExpenses      = tuitionMonthly+housing+food+transportation+booksSupplies+entertainment+personalCare+technology+healthWellness+miscellaneous;
      const savingsGap         = finalIncome - totalExpenses;
      
      // Division by zero protection
      const expenseRatio       = finalIncome > 0 ? totalExpenses / finalIncome : (totalExpenses > 0 ? 3 : 0);
      const essentialSpend     = tuitionMonthly+housing+food+transportation+booksSupplies+healthWellness;
      const discretionarySpend = entertainment+personalCare+technology+miscellaneous;
      const discretionaryRatio = finalIncome > 0 ? discretionarySpend / finalIncome : 0;

      // Calculate Budget Variance (Over-spending penalty)
      let overBudgetAmount = 0;
      Object.keys(targets).forEach(cat => {
        const actual = byCategory[cat] || 0;
        const target = targets[cat] || 0;
        if (target > 0 && actual > target) {
          overBudgetAmount += (actual - target);
        }
      });

      // Stress multiplier: If over budget, we artificially increase the perceived expense ratio for the ML
      const budgetPenalty = overBudgetAmount > 0 ? (overBudgetAmount / Math.max(finalIncome, 1)) * 0.5 : 0;
      const adjustedExpenseRatio = expenseRatio + budgetPenalty;

      const snapshot = { 
        totalIncome: finalIncome, 
        totalExpenses, 
        savingsGap, 
        expenseRatio, 
        essentialSpend, 
        discretionarySpend, 
        discretionaryRatio, 
        byCategory,
        overBudgetAmount,
        targets
      };

      // Build ML feature vector
      const features = {
        age: user.age||20,
        gender_enc:   { Male:0, Female:1, 'Non-binary':2 }[user.gender]??0,
        year_enc:     { Freshman:1, Sophomore:2, Junior:3, Senior:4 }[user.yearInSchool]??1,
        major_enc:    { Biology:0,'Computer Science':1, Economics:2, Engineering:3, Psychology:4, Other:5 }[user.major]??0,
        payment_enc:  { 'Credit/Debit Card':0, Cash:1, 'Mobile Payment App':2 }[user.paymentMethod]??0,
        monthly_income: Math.max(finalIncome, 1), // Prevent zero
        financial_aid: (budget?.financialAid || 0) + (byCategory.financial_aid||0),
        tuition_monthly: tuitionMonthly,
        housing, food, transportation,
        books_supplies: booksSupplies,
        entertainment, personal_care: personalCare,
        technology, health_wellness: healthWellness, miscellaneous,
      };

      // Call ML service
      let mlResult;
      let mlFallbackUsed = false;

      // Safety check: If no expenses, stress should be zero regardless of features
      if (totalExpenses === 0) {
        mlResult = {
          ft:  { stress_score: 0, stress_level: 'Low', confidence: 1.0 },
          xgb: { stress_score: 0, stress_level: 'Low', prob_low: 1.0, prob_medium: 0, prob_high: 0 },
          ensemble: { stress_score: 0, stress_level: 'Low' },
          shap: { 
            values: [], 
            base_value: 0, 
            top_risk: [], 
            top_positive: ['Zero expenditure'] 
          },
        };
      } else {
        try {
          const mlFeatures = { ...features, expense_ratio: adjustedExpenseRatio };
          const resp = await axios.post(`${ML_URL}/predict`, { features: mlFeatures }, { timeout: 10000 });
          mlResult = resp.data;
        } catch (err) {
          console.error('[ML SERVICE] Error:', err.message);
          mlFallbackUsed = true;
          
          // IMPROVED FALLBACK: Use actual expense data instead of hardcoded rules
          const score = Math.max(0, Math.min(100, ((adjustedExpenseRatio - 0.3) / 1.7) * 100));
          const level = score < 33 ? 'Low' : score < 66 ? 'Medium' : 'High';
          
          const sortedCats = Object.entries(byCategory)
            .filter(([k]) => k !== 'income' && k !== 'financial_aid')
            .sort((a, b) => b[1] - a[1]);
          
          const topRisk = sortedCats.slice(0, 3).map(([k]) => k.replace('_', ' '));
          const topPos  = expenseRatio < 0.5 ? ['low expense ratio'] : [];

          mlResult = {
            ft:  { stress_score: Math.max(0, score - 5), stress_level: (score - 5) < 33 ? 'Low' : (score - 5) < 66 ? 'Medium' : 'High', confidence: 0.5 },
            xgb: { stress_score: Math.min(100, score + 5), stress_level: (score + 5) < 33 ? 'Low' : (score + 5) < 66 ? 'Medium' : 'High', prob_low: level==='Low'?0.6:0.2, prob_medium: level==='Medium'?0.6:0.2, prob_high: level==='High'?0.6:0.2 },
            ensemble: { stress_score: score, stress_level: level },
            shap: { 
              values: sortedCats.slice(0, 6).map(([k, v]) => ({ display_name: k.replace('_', ' '), shap_value: (v / (totalExpenses || 1)) * 15 })), 
              base_value: 40, 
              top_risk: topRisk.length ? topRisk : ['High spending'], 
              top_positive: topPos 
            },
          };
        }
      }

      const ml = {
        ftStressScore:  mlResult.ft.stress_score,
        ftStressLevel:  mlResult.ft.stress_level,
        xgbStressScore: mlResult.xgb.stress_score,
        xgbStressLevel: mlResult.xgb.stress_level,
        xgbProbLow:     mlResult.xgb.prob_low,
        xgbProbMedium:  mlResult.xgb.prob_medium,
        xgbProbHigh:    mlResult.xgb.prob_high,
        ensembleScore:  mlResult.ensemble.stress_score,
        ensembleLevel:  mlResult.ensemble.stress_level,
        shapValues:     mlResult.shap.values,
        shapBaseValue:  mlResult.shap.base_value,
        topRiskFactors: mlResult.shap.top_risk,
        topPositiveFactors: mlResult.shap.top_positive,
      };

      const suggestions = buildSuggestions(snapshot, ml, user);

      const analysis = await Analysis.findOneAndUpdate(
        { userId: user._id, month },
        { 
          snapshot, 
          ml, 
          suggestions,
          ml_fallback_used: mlFallbackUsed,
          fallback_timestamp: mlFallbackUsed ? new Date() : null
        },
        { upsert: true, new: true, session }
      );

      await session.commitTransaction();
      logger.info('Analysis completed successfully', { userId: user._id, month, analysisId: analysis._id });
      res.json({ analysisId: analysis._id, month, snapshot, ml, suggestions });
    } catch (err) {
      await session.abortTransaction();
      if (err.code === 11000) {
        // Handle race condition: if duplicate created during transaction, fetch existing
        const existing = await Analysis.findOne({ userId: user._id, month });
        if (existing) return res.json(existing);
      }
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    logger.error('Analysis failed', { userId: req.user?._id, month: req.body?.month, error: err.message });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/:month
router.get('/:month', auth, async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ userId: req.user._id, month: req.params.month });
    if (!analysis) return res.status(404).json({ error: 'No analysis for this month' });
    res.json(analysis);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis — list all analyses for trend
router.get('/', auth, async (req, res) => {
  try {
    const items = await Analysis.find({ userId: req.user._id })
      .sort({ month: -1 }).limit(12)
      .select('month ml.ensembleScore ml.ensembleLevel snapshot.savingsGap snapshot.expenseRatio');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
