const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to Supabase PostgreSQL Database...");
        console.log("Creating table: event_checkins...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS event_checkins (
                id SERIAL PRIMARY KEY,
                customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
                checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                required_materials TEXT,
                employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
                assigned_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(20) DEFAULT 'Arrived',
                feedback TEXT,
                gifts_collected BOOLEAN DEFAULT FALSE,
                completed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Creating table: meet_orders...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS meet_orders (
                id SERIAL PRIMARY KEY,
                customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
                employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
                total_amount NUMERIC(15, 2) DEFAULT 0.00,
                synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Creating table: meet_order_items...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS meet_order_items (
                id SERIAL PRIMARY KEY,
                order_id INT REFERENCES meet_orders(id) ON DELETE CASCADE,
                product_id INT REFERENCES products(id) ON DELETE CASCADE,
                quantity INT NOT NULL,
                rate NUMERIC(15, 2) NOT NULL,
                amount NUMERIC(15, 2) NOT NULL
            )
        `);

        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err.message);
    } finally {
        await pool.end();
    }
}

run();
