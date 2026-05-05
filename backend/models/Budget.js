const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month:  { type: String, required: true }, // "2024-03"
  targets: {
    housing:        { type: Number, default: 0 },
    food:           { type: Number, default: 0 },
    transportation: { type: Number, default: 0 },
    books_supplies: { type: Number, default: 0 },
    entertainment:  { type: Number, default: 0 },
    personal_care:  { type: Number, default: 0 },
    technology:     { type: Number, default: 0 },
    health_wellness:{ type: Number, default: 0 },
    miscellaneous:  { type: Number, default: 0 },
    tuition:        { type: Number, default: 0 },
  },
  monthlyIncome:  { type: Number, default: 0 },
  financialAid:   { type: Number, default: 0 },
});

budgetSchema.index({ userId: 1, month: 1 }, { unique: true });
module.exports = mongoose.model('Budget', budgetSchema);
