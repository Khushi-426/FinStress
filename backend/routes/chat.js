const express  = require('express');
const axios    = require('axios');
const auth     = require('../middleware/auth');
const Analysis = require('../models/Analysis');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { message, month, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let context = '';
    if (month) {
      const analysis = await Analysis.findOne({ userId: req.user._id, month });
      if (analysis) {
        const { snapshot: s, ml } = analysis;
        context = `Student's ${month} finances:
- Income: $${Math.round(s.totalIncome)}, Expenses: $${Math.round(s.totalExpenses)}, Gap: $${Math.round(s.savingsGap)}
- Stress score: ${Math.round(ml.ensembleScore)}/100 (${ml.ensembleLevel})
- Top risk factors (SHAP): ${ml.topRiskFactors?.join(', ')||'N/A'}
- By category: ${Object.entries(s.byCategory||{}).map(([k,v])=>`${k}: $${Math.round(v)}`).join(', ')}`;
      }
    }

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `You are FinBot, a helpful financial advisor for college students. ${context ? `\n\nContext:\n${context}` : ''}
Be concise (2-4 sentences), practical, and encouraging. Reference their actual numbers when possible.`,
      messages: [...history.slice(-8).map(h=>({ role:h.role, content:h.content })), { role:'user', content:message }],
    }, {
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    res.json({ reply: response.data.content[0]?.text || 'Sorry, try again.' });
  } catch (err) {
    console.error('Chat:', err.response?.data || err.message);
    res.status(500).json({ error: 'Chat unavailable' });
  }
});

module.exports = router;
