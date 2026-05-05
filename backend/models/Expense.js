const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:     { type: Date, required: true, default: Date.now },
  category: {
    type: String, required: true,
    enum: ['housing','food','transportation','books_supplies','entertainment',
           'personal_care','technology','health_wellness','miscellaneous','tuition','income','financial_aid'],
  },
  amount:   { type: Number, required: true },
  // positive = expense, negative not used; income/aid stored as separate category type
  type:     { type: String, enum: ['expense','income'], default: 'expense' },
  note:     { type: String, maxlength: 200, default: '' },
  isRecurring: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
