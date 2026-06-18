const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to Supabase PostgreSQL Database...");
        console.log("Running migration: ALTER TABLE customers ALTER COLUMN gstin TYPE VARCHAR(20)...");
        await pool.query('ALTER TABLE customers ALTER COLUMN gstin TYPE VARCHAR(20)');
        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err.message);
    } finally {
        await pool.end();
    }
}

run();
