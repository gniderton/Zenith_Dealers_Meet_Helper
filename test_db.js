const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to Supabase PostgreSQL Database...");
        const res = await pool.query('SELECT NOW(), current_database(), current_user');
        console.log("Connection successful!");
        console.log("Server time:", res.rows[0].now);
        console.log("Database name:", res.rows[0].current_database);
        console.log("Current user:", res.rows[0].current_user);
    } catch (err) {
        console.error("Connection failed:", err.message);
    } finally {
        await pool.end();
    }
}

run();
