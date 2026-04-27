// Data Plane Security Middleware (Provided by Team A04)
const internalAuth = (req, res, next) => {
  const serviceKey = req.header('x-internal-service-key');

  if (!serviceKey || serviceKey !== process.env.INTERNAL_SERVICE_KEY) {
    console.error('Unauthorized access attempt to Data Plane');
    return res.status(403).json({ error: 'Forbidden: Invalid Internal Service Key' });
  }

  next();
};

module.exports = internalAuth;