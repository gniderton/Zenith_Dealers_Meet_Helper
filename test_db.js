const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to Supabase PostgreSQL Database...");
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'routes'
        `);
        console.log("Routes Table Columns:");
        console.table(res.rows);
    } catch (err) {
        console.error("Failed:", err.message);
    } finally {
        await pool.end();
    }
}

run();
