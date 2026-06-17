const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000; // Render sets PORT automatically

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// PostgreSQL Connection Pool config
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

// 2. Brands CRUD Endpoints

// GET /api/brands - Get all brands
app.get('/api/brands', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM brands ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/brands/:id - Get a single brand by ID or brand_code
app.get('/api/brands/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let result;
        // If query param is a number, search by ID, else search by brand_code
        if (/^\d+$/.test(id)) {
            result = await pool.query('SELECT * FROM brands WHERE id = $1', [id]);
        } else {
            result = await pool.query('SELECT * FROM brands WHERE brand_code = $1', [id]);
        }
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Brand not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/brands - Create a new brand
app.post('/api/brands', async (req, res) => {
    const { brand_name, description, logo_url, status } = req.body;
    
    if (!brand_name) {
        return res.status(400).json({ error: 'Brand name is required' });
    }

    try {
        // Insert into table, the brand_code will auto-generate via sequence
        const result = await pool.query(
            `INSERT INTO brands (brand_name, description, logo_url, status) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [brand_name, description || null, logo_url || null, status || 'Active']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // Unique constraint violation (brand_name or brand_code)
            return res.status(400).json({ error: 'Brand name already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/brands/:id - Update an existing brand
app.put('/api/brands/:id', async (req, res) => {
    const { id } = req.params;
    const { brand_name, description, logo_url, status } = req.body;

    if (!brand_name) {
        return res.status(400).json({ error: 'Brand name is required' });
    }

    try {
        const result = await pool.query(
            `UPDATE brands 
             SET brand_name = $1, description = $2, logo_url = $3, status = $4, updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 RETURNING *`,
            [brand_name, description || null, logo_url || null, status || 'Active', id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Brand not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Brand name already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/brands/:id - Delete a brand
app.delete('/api/brands/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM brands WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Brand not found' });
        }
        res.json({ message: 'Brand deleted successfully', brand: result.rows[0] });
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
