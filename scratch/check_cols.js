const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'customers'
        `);
        console.log("Customers Table Columns:");
        console.table(res.rows);
    } catch (err) {
        console.error("Failed:", err.message);
    } finally {
        await pool.end();
    }
}

run();
