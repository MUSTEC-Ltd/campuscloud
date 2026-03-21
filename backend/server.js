const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true })); // Enable CORS for cookies
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/', require('./routes/signup'));
app.use('/', require('./routes/login'));
app.use('/project', require('./routes/projects'));

// Health check
app.get('/', (req, res) => {
  res.send('CampusCloud Identity & Project API is running');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
