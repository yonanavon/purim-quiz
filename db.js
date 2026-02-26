require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('a','b','c','d','j')),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Migration: allow 'j' (joke) in existing tables
    await client.query(`
      ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_correct_answer_check
    `);
    await client.query(`
      ALTER TABLE questions ADD CONSTRAINT questions_correct_answer_check
        CHECK (correct_answer IN ('a','b','c','d','j'))
    `);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
