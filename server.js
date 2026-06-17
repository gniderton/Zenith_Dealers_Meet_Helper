const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// PostgreSQL Connection Pool config (Postgres Pooler direct connecting to Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Test DB Connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Supabase Connection Error:', err.message);
    } else {
        console.log('⚡ Supabase Connection Successful at:', res.rows[0].now);
    }
});

// --- API ROUTES ---

// 1. Get health status
app.get('/health', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date() });
});

// 2. Dealers CRUD
app.get('/api/dealers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM dealers ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/dealers', async (req, res) => {
    const { dealer_name, shop_name, region, mobile, email, rsvp_status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO dealers (dealer_name, shop_name, region, mobile, email, rsvp_status) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [dealer_name, shop_name, region, mobile, email, rsvp_status || 'Pending']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/dealers/:id', async (req, res) => {
    const { id } = req.params;
    const { dealer_name, shop_name, region, mobile, email, rsvp_status, attendance_status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE dealers 
             SET dealer_name = $1, shop_name = $2, region = $3, mobile = $4, email = $5, rsvp_status = $6, attendance_status = $7
             WHERE id = $8 RETURNING *`,
            [dealer_name, shop_name, region, mobile, email, rsvp_status, attendance_status, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Dealer not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/dealers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM dealers WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Dealer not found' });
        res.json({ message: 'Dealer deleted successfully', dealer: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Check-ins Endpoints
app.post('/api/checkins', async (req, res) => {
    const { dealer_id, hotel_room_no, transport_mode, transport_details, remarks } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Create checkin record
        const checkinRes = await client.query(
            `INSERT INTO checkins (dealer_id, hotel_room_no, transport_mode, transport_details, remarks)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [dealer_id, hotel_room_no, transport_mode, transport_details, remarks]
        );

        // Update dealer attendance status
        await client.query(
            `UPDATE dealers SET attendance_status = 'Checked-In' WHERE id = $1`,
            [dealer_id]
        );

        await client.query('COMMIT');
        res.status(201).json(checkinRes.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 4. Agenda Endpoints
app.get('/api/agenda', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM agenda ORDER BY start_time ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/agenda', async (req, res) => {
    const { title, description, speaker, start_time, end_time, venue } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO agenda (title, description, speaker, start_time, end_time, venue)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [title, description, speaker, start_time, end_time, venue]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Feedback Endpoints
app.post('/api/feedback', async (req, res) => {
    const { dealer_id, session_rating, food_rating, overall_rating, comments } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO feedback (dealer_id, session_rating, food_rating, overall_rating, comments)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [dealer_id, session_rating, food_rating, overall_rating, comments]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/feedback', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT f.*, d.dealer_name, d.shop_name 
             FROM feedback f
             LEFT JOIN dealers d ON f.dealer_id = d.id 
             ORDER BY f.submitted_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Server Initialization
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
