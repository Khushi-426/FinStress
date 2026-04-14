const express  = require('express');
const axios    = require('axios');
const auth     = require('../middleware/auth');
const Expense  = require('../models/Expense');
const Budget   = require('../models/Budget');
const Analysis = require('../models/Analysis');

const router  = express.Router();
const ML_URL  = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const PEER = {
  Freshman:  { avgStress:67.1, avgIncome:1561, avgExpenses:2189 },
  Sophomore: { avgStress:69.4, avgIncome:1491, avgExpenses:2138 },
  Junior:    { avgStress:68.7, avgIncome:1521, avgExpenses:2172 },
  Senior:    { avgStress:69.7, avgIncome:1527, avgExpenses:2188 },
};

function buildSuggestions(snap, ml, user) {
  const sugs = [];
  const { byCategory, totalIncome, totalExpenses, savingsGap, discretionaryRatio } = snap;

  if (savingsGap < 0) sugs.push({ category:'budget', severity:'danger',
    title:'Monthly deficit detected',
    text:`You spent $${Math.abs(Math.round(savingsGap))} more than you earned this month. This is your biggest stress driver — cut expenses or increase income.`,
    potential: Math.abs(Math.round(savingsGap)) });

  if ((byCategory.entertainment||0) > 120) sugs.push({ category:'entertainment', severity:'danger',
    title:'Entertainment is high',
    text:`You spent $${Math.round(byCategory.entertainment)}/mo on entertainment. Student average is ~$85. Cutting to average saves $${Math.round((byCategory.entertainment||0)-85)}/mo.`,
    potential: Math.round((byCategory.entertainment||0)-85) });

  if ((byCategory.food||0) > 320) sugs.push({ category:'food', severity:'warn',
    title:'Food costs above average',
    text:`$${Math.round(byCategory.food)}/mo on food is above the ~$253 student average. Meal prepping 3 days/week can cut this by 20–25%.`,
    potential: Math.round((byCategory.food||0)*0.22) });

  if ((byCategory.technology||0) > 200) sugs.push({ category:'technology', severity:'warn',
    title:'High technology spend',
    text:`$${Math.round(byCategory.technology)}/mo on technology. Review active subscriptions — many have free student tiers.`,
    potential: Math.round((byCategory.technology||0)-180) });

  if (discretionaryRatio > 0.3) sugs.push({ category:'discretionary', severity:'warn',
    title:'Discretionary spending above 30%',
    text:`${Math.round(discretionaryRatio*100)}% of your income goes to non-essential spending. Target is below 20%.`,
    potential: Math.round((discretionaryRatio - 0.2) * totalIncome) });

  if (ml.ensembleScore < 40 && savingsGap > 100) sugs.push({ category:'savings', severity:'good',
    title:'Great — start investing your surplus',
    text:`You have a $${Math.round(savingsGap)}/mo surplus. Consider putting $${Math.round(savingsGap*0.5)} into a high-yield savings account each month.`,
    potential: 0 });

  if (sugs.length === 0) sugs.push({ category:'general', severity:'good',
    title:'Your finances look healthy this month',
    text:'Keep tracking consistently to spot trends over time.', potential: 0 });

  return sugs;
}

// POST /api/analysis/run?month=2024-03
router.post('/run', auth, async (req, res) => {
  try {
    const month = req.body.month || new Date().toISOString().slice(0,7);
    const [y, m] = month.split('-');
    const start  = new Date(+y, +m - 1, 1);
    const end    = new Date(+y, +m, 1);
    const user   = req.user;

    // Aggregate expenses for the month
    const agg = await Expense.aggregate([
      { $match: { userId: user._id, date: { $gte: start, $lt: end } } },
      { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' } } },
    ]);

    const byCategory = {};
    let totalIncome = 0;
    agg.forEach(({ _id, total }) => {
      byCategory[_id.category] = (byCategory[_id.category] || 0) + total;
      if (_id.category === 'income' || _id.category === 'financial_aid') totalIncome += total;
    });

    // Pull budget for income if not tracked as expenses
    const budget = await Budget.findOne({ userId: user._id, month });
    if (budget) {
      if (!totalIncome) totalIncome = (budget.monthlyIncome||0) + (budget.financialAid||0);
    }

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
    const savingsGap         = totalIncome - totalExpenses;
    const expenseRatio       = totalIncome > 0 ? totalExpenses/totalIncome : 3;
    const essentialSpend     = tuitionMonthly+housing+food+transportation+booksSupplies+healthWellness;
    const discretionarySpend = entertainment+personalCare+technology+miscellaneous;
    const discretionaryRatio = totalIncome > 0 ? discretionarySpend/totalIncome : 1;

    const snapshot = { totalIncome, totalExpenses, savingsGap, expenseRatio, essentialSpend, discretionarySpend, discretionaryRatio, byCategory };

    // Build ML feature vector
    const features = {
      age: user.age||20,
      gender_enc:   { Male:0, Female:1, 'Non-binary':2 }[user.gender]??0,
      year_enc:     { Freshman:1, Sophomore:2, Junior:3, Senior:4 }[user.yearInSchool]??1,
      major_enc:    { Biology:0,'Computer Science':1, Economics:2, Engineering:3, Psychology:4, Other:5 }[user.major]??0,
      payment_enc:  { 'Credit/Debit Card':0, Cash:1, 'Mobile Payment App':2 }[user.paymentMethod]??0,
      monthly_income: totalIncome,
      financial_aid: byCategory.financial_aid||0,
      tuition_monthly: tuitionMonthly,
      housing, food, transportation,
      books_supplies: booksSupplies,
      entertainment, personal_care: personalCare,
      technology, health_wellness: healthWellness, miscellaneous,
    };

    // Call ML service
    let mlResult;
    try {
      const resp = await axios.post(`${ML_URL}/predict`, { features }, { timeout: 10000 });
      mlResult = resp.data;
    } catch {
      const score = Math.max(0, Math.min(100, ((expenseRatio-0.3)/1.7)*100));
      const level = score < 33 ? 'Low' : score < 66 ? 'Medium' : 'High';
      mlResult = {
        ft:  { stress_score: score, stress_level: level, confidence: 0.6 },
        xgb: { stress_score: score, stress_level: level, prob_low: level==='Low'?0.7:0.15, prob_medium: level==='Medium'?0.7:0.15, prob_high: level==='High'?0.7:0.15 },
        ensemble: { stress_score: score, stress_level: level },
        shap: { values: [], base_value: 50, top_risk: ['expense_ratio'], top_positive: [] },
      };
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
      { snapshot, ml, suggestions },
      { upsert: true, new: true }
    );

    res.json({ analysisId: analysis._id, month, snapshot, ml, suggestions });
  } catch (err) {
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
