const axios = require('axios');

// This client automatically attaches the secure key to all Data Plane requests
const computeClient = axios.create({
  baseURL: process.env.DATA_PLANE_URL || 'http://localhost:5001', // Whatever port the B teams use
  headers: {
    'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY,
    'Content-Type': 'application/json'
  }
});

module.exports = computeClient;

// Usage example inside a route: 
// const computeClient = require('../utils/computeClient');
// await computeClient.post('/instance', { projectId: req.project.id });