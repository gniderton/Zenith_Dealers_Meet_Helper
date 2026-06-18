const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const routes = await pool.query('SELECT id, route_name FROM routes');
        console.log("Routes in Database:");
        console.table(routes.rows);

        const employees = await pool.query('SELECT id, employee_name FROM employees');
        console.log("Employees in Database:");
        console.table(employees.rows);

        const channels = await pool.query('SELECT id, channel_name FROM channels');
        console.log("Channels in Database:");
        console.table(channels.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
