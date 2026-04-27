const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Fail fast if required secrets are missing
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_ACCESS_SECRET (or JWT_SECRET) environment variable is not set.');
  process.exit(1);
}

const app = express();

// Only allow the frontend origin (and localhost variants for dev)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check — registered before route handlers
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'CampusCloud Identity & Project API' });
});

// Routes
app.use('/', require('./routes/signup'));
app.use('/', require('./routes/login'));
app.use('/project', require('./routes/projects'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
