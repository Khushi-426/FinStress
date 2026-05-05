const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 6 },
  age:          { type: Number, min: 13, max: 35 },
  gender:       { type: String, enum: ['Male', 'Female', 'Non-binary'] },
  yearInSchool: { type: String, enum: ['Freshman', 'Sophomore', 'Junior', 'Senior'] },
  major:        { type: String, enum: ['Computer Science','Engineering','Biology','Economics','Psychology','Other'] },
  paymentMethod:{ type: String, enum: ['Credit/Debit Card','Cash','Mobile Payment App'], default: 'Credit/Debit Card' },
  googleId:     { type: String, unique: true, sparse: true },
  isGoogleUser: { type: Boolean, default: false },
  customCategories: [{
    id:    { type: String, required: true },
    label: { type: String, required: true },
    icon:  { type: String, default: '📦' },
    color: { type: String, default: '#90a4ae' },
    type:  { type: String, default: 'expense' }
  }],
  createdAt:    { type: Date, default: Date.now },
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || this.isGoogleUser) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function(c) { return bcrypt.compare(c, this.password); };
userSchema.methods.toSafeObject = function() { const o = this.toObject(); delete o.password; return o; };

module.exports = mongoose.model('User', userSchema);
