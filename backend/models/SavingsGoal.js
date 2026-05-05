const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  currentAmount: { type: Number, default: 0 },
  deadline: { type: Date },
  category: { type: String, default: 'general' },
  color: { type: String, default: '#8faeff' },
  isCompleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

savingsGoalSchema.query.active = function() {
  return this.where({ deletedAt: null });
};

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
