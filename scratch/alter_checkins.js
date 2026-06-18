const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from current dir or parent dir
const envPath = fs.existsSync(path.join(__dirname, '../.env')) 
    ? path.join(__dirname, '../.env') 
    : path.join(__dirname, './.env');

dotenv.config({ path: envPath });

console.log("Database connection URL is loaded: ", !!process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Altering event_checkins table to add visitor details...");
        await pool.query(`
            ALTER TABLE event_checkins 
            ADD COLUMN IF NOT EXISTS visitor_name VARCHAR(150),
            ADD COLUMN IF NOT EXISTS contact_number VARCHAR(15),
            ADD COLUMN IF NOT EXISTS no_of_people INT DEFAULT 1,
            ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS badge_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS checkin_notes TEXT;
        `);
        console.log("Columns successfully added!");
    } catch (err) {
        console.error("Migration failed:", err.message);
    } finally {
        await pool.end();
    }
}

run();
