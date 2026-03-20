const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
  const adminConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // Connect to default DB first
  };

  const dbName = process.env.DB_NAME || 'campuscloud';

  const client = new Client(adminConfig);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL admin database.');

    // Check if DB exists
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      console.log(`Creating database ${dbName}...`);
      await client.query(`CREATE DATABASE ${dbName}`);
    } else {
      console.log(`Database ${dbName} already exists.`);
    }
    await client.end();

    // Now connect to the new DB and run schema
    const dbConfig = { ...adminConfig, database: dbName };
    const dbClient = new Client(dbConfig);
    await dbClient.connect();
    console.log(`Connected to database ${dbName}.`);

    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema.sql...');
    await dbClient.query(schema);
    console.log('Schema applied successfully.');

    await dbClient.end();
  } catch (err) {
    console.error('Error setting up database:', err.message);
    process.exit(1);
  }
}

setup();
