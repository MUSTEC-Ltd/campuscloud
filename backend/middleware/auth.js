const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utils/tokens');

const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);

  // Demo token: pass through — frontend enforces access control locally
  if (token === 'cc-demo-mode-v1') {
    req.user = { id: 'demo-00000000-0000-0000-0000-000000000001', email: 'demo@campuscloud.local' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
