const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  month:     { type: String, required: true }, // "2024-03"
  snapshot: {                                  // aggregated from expenses for that month
    totalIncome:        Number,
    totalExpenses:      Number,
    savingsGap:         Number,
    expenseRatio:       Number,
    essentialSpend:     Number,
    discretionarySpend: Number,
    discretionaryRatio: Number,
    byCategory:         mongoose.Schema.Types.Mixed,
  },
  ml: {
    ftStressScore:  Number,
    ftStressLevel:  String,
    xgbStressScore: Number,
    xgbStressLevel: String,
    xgbProbLow:     Number,
    xgbProbMedium:  Number,
    xgbProbHigh:    Number,
    ensembleScore:  Number,
    ensembleLevel:  String,
    shapValues:     mongoose.Schema.Types.Mixed,
    shapBaseValue:  Number,
    topRiskFactors: [String],
    topPositiveFactors: [String],
  },
  suggestions: [{ category: String, severity: String, title: String, text: String, potential: Number }],
  createdAt: { type: Date, default: Date.now },
});

analysisSchema.index({ userId: 1, month: 1 });
module.exports = mongoose.model('Analysis', analysisSchema);
