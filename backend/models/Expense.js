const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:     { type: Date, required: true, default: Date.now },
  category: {
    type: String, required: true,
  },
  amount:   { type: Number, required: true },
  // positive = expense, negative not used; income/aid stored as separate category type
  type:     { type: String, enum: ['expense','income'], default: 'expense' },
  note:     { type: String, maxlength: 200, default: '' },
  isRecurring: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

// Filter out soft-deleted by default
expenseSchema.query.active = function () {
  return this.where({ deletedAt: null });
};

expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, deletedAt: 1 }); // Index for soft delete queries

module.exports = mongoose.model('Expense', expenseSchema);
