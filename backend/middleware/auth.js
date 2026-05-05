const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const CURRENT_KEY = process.env.JWT_SECRET;
const LEGACY_KEYS = (process.env.JWT_LEGACY_SECRETS || '').split(',').filter(Boolean);

module.exports = async (req, res, next) => {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    
    const token = h.split(' ')[1];
    let decoded;
    
    // 1. Try current key first
    try {
      decoded = jwt.verify(token, CURRENT_KEY);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      
      // 2. Try legacy keys if current key failed (but not because of expiry)
      for (const key of LEGACY_KEYS) {
        try {
          decoded = jwt.verify(token, key);
          if (decoded) break;
        } catch {}
      }
      
      if (!decoded) throw err;
    }
    
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch (err) { 
    res.status(401).json({ error: 'Invalid token' }); 
  }
};
