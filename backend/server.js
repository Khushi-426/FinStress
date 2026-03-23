require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 200 }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/budget',   require('./routes/budget'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/chat',     require('./routes/chat'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/finstress')
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5000, () => console.log(`🚀 Server on :${process.env.PORT || 5000}`));
  })
  .catch(err => { console.error(err); process.exit(1); });
