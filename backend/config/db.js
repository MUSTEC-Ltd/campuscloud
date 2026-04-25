const { Pool } = require('pg');
require('dotenv').config();

// Managed Postgres providers (Supabase, Neon, RDS, Heroku, etc.) almost always
// require SSL. Enable it when DB_SSL=true; reject-unauthorized can also be
// disabled when the provider hands out a self-signed cert.
let ssl = false;
if ((process.env.DB_SSL || '').toLowerCase() === 'true') {
  ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'campuscloud',
  ssl,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
});

module.exports = { pool };
