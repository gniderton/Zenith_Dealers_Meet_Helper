const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
const multer = require('multer');
const XLSX = require('xlsx');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Multer in-memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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

// 2. Brands Template Download Endpoint
// GET /api/brands/template - Downloads Excel template
app.get('/api/brands/template', (req, res) => {
    try {
        // Create headers and one example row
        const templateData = [
            {
                "ID (Only for updates)": "",
                "Brand Name": "Example Brand",
                "Brand Code (Only for updates)": "",
                "Description": "This is an optional description of the brand",
                "Logo URL": "https://example.com/logo.png",
                "Status": "Active"
            }
        ];

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        XLSX.utils.book_append_sheet(wb, ws, "Brands Template");

        // Write to buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers to force download
        res.setHeader('Content-Disposition', 'attachment; filename="brands_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate template: ' + err.message });
    }
});

// 3. Brands Bulk Upload Endpoint
// POST /api/brands/upload - Parses uploaded CSV or Excel file and inserts/updates brands
app.post('/api/brands/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)' });
    }

    const client = await pool.connect();
    try {
        // Read workbook from file buffer
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse sheet to JSON array
        const rawRows = XLSX.utils.sheet_to_json(worksheet);
        
        if (rawRows.length === 0) {
            return res.status(400).json({ error: 'The uploaded file is empty' });
        }

        let insertedCount = 0;
        let updatedCount = 0;
        let errors = [];

        await client.query('BEGIN');

        for (let index = 0; index < rawRows.length; index++) {
            const row = rawRows[index];
            const rowNumber = index + 2; // Row offset (header is row 1)

            // Extract values using various header naming variations
            const id = row["ID (Only for updates)"] || row["id"] || row["ID"];
            const brand_name = row["Brand Name"] || row["brand_name"] || row["BrandName"];
            const brand_code = row["Brand Code (Only for updates)"] || row["brand_code"] || row["BrandCode"];
            const description = row["Description"] || row["description"];
            const logo_url = row["Logo URL"] || row["logo_url"] || row["LogoUrl"];
            const status = row["Status"] || row["status"] || 'Active';

            if (!brand_name) {
                errors.push({ row: rowNumber, error: 'Brand Name is missing' });
                continue;
            }

            try {
                let matchFound = false;

                // 1. Match by ID if provided
                if (id && /^\d+$/.test(id)) {
                    const checkId = await client.query('SELECT id FROM brands WHERE id = $1', [id]);
                    if (checkId.rows.length > 0) {
                        await client.query(
                            `UPDATE brands 
                             SET brand_name = $1, description = $2, logo_url = $3, status = $4, updated_at = CURRENT_TIMESTAMP
                             WHERE id = $5`,
                            [brand_name, description || null, logo_url || null, status, id]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }

                // 2. Match by Brand Code if provided
                if (!matchFound && brand_code) {
                    const checkCode = await client.query('SELECT id FROM brands WHERE brand_code = $1', [brand_code]);
                    if (checkCode.rows.length > 0) {
                        await client.query(
                            `UPDATE brands 
                             SET brand_name = $1, description = $2, logo_url = $3, status = $4, updated_at = CURRENT_TIMESTAMP
                             WHERE brand_code = $5`,
                            [brand_name, description || null, logo_url || null, status, brand_code]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }

                // 3. Match by Brand Name
                if (!matchFound) {
                    const checkName = await client.query('SELECT id FROM brands WHERE brand_name = $1', [brand_name]);
                    if (checkName.rows.length > 0) {
                        await client.query(
                            `UPDATE brands 
                             SET description = $1, logo_url = $2, status = $3, updated_at = CURRENT_TIMESTAMP
                             WHERE brand_name = $4`,
                            [description || null, logo_url || null, status, brand_name]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }

                // 4. If no match, insert as new brand
                if (!matchFound) {
                    await client.query(
                        `INSERT INTO brands (brand_name, description, logo_url, status) 
                         VALUES ($1, $2, $3, $4)`,
                        [brand_name, description || null, logo_url || null, status]
                    );
                    insertedCount++;
                }
            } catch (rowErr) {
                errors.push({ row: rowNumber, brand: brand_name, error: rowErr.message });
            }
        }

        await client.query('COMMIT');

        res.json({
            message: 'Bulk processing completed',
            summary: {
                totalRows: rawRows.length,
                inserted: insertedCount,
                updated: updatedCount,
                failed: errors.length
            },
            errors: errors.length > 0 ? errors : null
        });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Transaction failed: ' + err.message });
    } finally {
        client.release();
    }
});

// 4. Brands CRUD Endpoints

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

// POST /api/brands - Create a new brand manually
app.post('/api/brands', async (req, res) => {
    const { brand_name, description, logo_url, status } = req.body;
    
    if (!brand_name) {
        return res.status(400).json({ error: 'Brand name is required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO brands (brand_name, description, logo_url, status) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [brand_name, description || null, logo_url || null, status || 'Active']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Brand name already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/brands/:id - Update an existing brand manually
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

// DELETE /api/brands/:id - Delete a brand manually
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
