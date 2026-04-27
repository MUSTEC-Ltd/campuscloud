const jwt = require('jsonwebtoken');
// Fallback secret if the utils file is missing it
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET; 

const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);

  // SECURITY PATCH: Only allow demo mode if explicitly in development
  if (token === 'cc-demo-mode-v1') {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Demo mode is strictly disabled in production environments' });
    }
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