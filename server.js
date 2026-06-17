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

// Helper Function: Auto-detect and parse raw Appsmith 2D array format:
// [{ name: "Sheet1", data: [[headers], [row1], [row2]] }]
function parseRaw2DArray(body) {
    if (Array.isArray(body) && body.length === 1 && body[0].data && Array.isArray(body[0].data)) {
        console.log("Detected raw 2D array payload, parsing it...");
        const sheetData = body[0].data;
        if (sheetData.length >= 2) {
            const headers = sheetData[0];
            const rows = sheetData.slice(1);
            return rows.map(row => {
                let obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index];
                });
                return obj;
            });
        }
    }
    return body;
}

// --- GENERAL ROUTES ---
app.get('/health', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date() });
});

// GET /api/:entity/template - Downloads Excel template dynamically
app.get('/api/:entity/template', (req, res) => {
    const { entity } = req.params;
    let templateData = [];

    switch (entity.toLowerCase()) {
        case 'brands':
        case 'brand':
            templateData = [{
                "ID (Only for updates)": "",
                "Brand Name": "Example Brand",
                "Brand Code (Only for updates)": "",
                "Description": "This is an optional description of the brand",
                "Logo URL": "https://example.com/logo.png",
                "Status": "Active"
            }];
            break;
        case 'categories':
        case 'category':
            templateData = [{
                "ID (Only for updates)": "",
                "Category Name": "Example Category",
                "Category Code (Only for updates)": "",
                "Description": "This is an optional description of the category",
                "Status": "Active"
            }];
            break;
        case 'channels':
        case 'channel':
            templateData = [{
                "ID (Only for updates)": "",
                "Channel Name": "Example Channel",
                "Channel Code (Only for updates)": "",
                "Description": "This is an optional description of the channel",
                "Status": "Active"
            }];
            break;
        case 'employees':
        case 'employee':
            templateData = [{
                "ID (Only for updates)": "",
                "Employee Name": "John Doe",
                "Employee Code (Only for updates)": "",
                "Email": "john.doe@example.com",
                "Mobile": "9876543210",
                "Designation": "Sales Manager",
                "Status": "Active"
            }];
            break;
        case 'gst':
            templateData = [{
                "ID (Only for updates)": "",
                "GST Name": "GST 18%",
                "GST Rate": 18.00,
                "Description": "Standard 18% GST rate",
                "Status": "Active"
            }];
            break;
        case 'hsn':
        case 'hsn_codes':
        case 'hsn code':
            templateData = [{
                "ID (Only for updates)": "",
                "HSN Code": "84713010",
                "Description": "Laptop computers",
                "GST ID": "",
                "GST Rate": 18.00,
                "Status": "Active"
            }];
            break;
        default:
            return res.status(400).json({ error: `Template for entity '${entity}' is not supported.` });
    }

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        XLSX.utils.book_append_sheet(wb, ws, `${entity} Template`);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="${entity.toLowerCase()}_template.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate template: ' + err.message });
    }
});

// ==========================================
// 1. BRANDS ENDPOINTS
// ==========================================

// GET /api/brands - Get all brands
app.get('/api/brands', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM brands ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/brands/bulk - Bulk import (accepts JSON array of objects or raw Appsmith 2D sheets)
app.post('/api/brands/bulk', async (req, res) => {
    const rawBody = parseRaw2DArray(req.body);
    if (!Array.isArray(rawBody)) {
        return res.status(400).json({ error: 'Expected an array' });
    }

    const client = await pool.connect();
    try {
        let insertedCount = 0;
        let updatedCount = 0;
        let errors = [];

        await client.query('BEGIN');

        for (let index = 0; index < rawBody.length; index++) {
            const row = rawBody[index];
            const rowNumber = index + 1;

            const id = row.id || row.ID || row["ID (Only for updates)"];
            const brand_name = row.brand_name || row["Brand Name"] || row.BrandName;
            const brand_code = row.brand_code || row["Brand Code (Only for updates)"] || row.BrandCode;
            const description = row.description || row.Description;
            const logo_url = row.logo_url || row["Logo URL"] || row.LogoUrl;
            const status = row.status || row.Status || 'Active';

            if (!brand_name) {
                errors.push({ row: rowNumber, error: 'Brand Name is missing' });
                continue;
            }

            try {
                let matchFound = false;

                // Match by ID
                if (id && /^\d+$/.test(id)) {
                    const check = await client.query('SELECT id FROM brands WHERE id = $1', [id]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE brands SET brand_name = $1, description = $2, logo_url = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
                            [brand_name, description || null, logo_url || null, status, id]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                // Match by Code
                if (!matchFound && brand_code) {
                    const check = await client.query('SELECT id FROM brands WHERE brand_code = $1', [brand_code]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE brands SET brand_name = $1, description = $2, logo_url = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE brand_code = $5`,
                            [brand_name, description || null, logo_url || null, status, brand_code]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                // Match by Name
                if (!matchFound) {
                    const check = await client.query('SELECT id FROM brands WHERE brand_name = $1', [brand_name]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE brands SET description = $1, logo_url = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE brand_name = $4`,
                            [description || null, logo_url || null, status, brand_name]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                // Insert new
                if (!matchFound) {
                    await client.query(
                        `INSERT INTO brands (brand_name, description, logo_url, status) VALUES ($1, $2, $3, $4)`,
                        [brand_name, description || null, logo_url || null, status]
                    );
                    insertedCount++;
                }
            } catch (err) {
                errors.push({ row: rowNumber, error: err.message });
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Success', summary: { totalRows: rawBody.length, inserted: insertedCount, updated: updatedCount, failed: errors.length }, errors: errors.length > 0 ? errors : null });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 2. CATEGORIES ENDPOINTS
// ==========================================

// GET /api/categories
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/categories/bulk
app.post('/api/categories/bulk', async (req, res) => {
    const rawBody = parseRaw2DArray(req.body);
    if (!Array.isArray(rawBody)) return res.status(400).json({ error: 'Expected an array' });

    const client = await pool.connect();
    try {
        let insertedCount = 0;
        let updatedCount = 0;
        let errors = [];

        await client.query('BEGIN');

        for (let index = 0; index < rawBody.length; index++) {
            const row = rawBody[index];
            const rowNumber = index + 1;

            const id = row.id || row.ID || row["ID (Only for updates)"];
            const category_name = row.category_name || row["Category Name"] || row.CategoryName;
            const category_code = row.category_code || row["Category Code (Only for updates)"] || row.CategoryCode;
            const description = row.description || row.Description;
            const status = row.status || row.Status || 'Active';

            if (!category_name) {
                errors.push({ row: rowNumber, error: 'Category Name is missing' });
                continue;
            }

            try {
                let matchFound = false;

                if (id && /^\d+$/.test(id)) {
                    const check = await client.query('SELECT id FROM categories WHERE id = $1', [id]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE categories SET category_name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
                            [category_name, description || null, status, id]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound && category_code) {
                    const check = await client.query('SELECT id FROM categories WHERE category_code = $1', [category_code]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE categories SET category_name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE category_code = $4`,
                            [category_name, description || null, status, category_code]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    const check = await client.query('SELECT id FROM categories WHERE category_name = $1', [category_name]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE categories SET description = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE category_name = $3`,
                            [description || null, status, category_name]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    await client.query(
                        `INSERT INTO categories (category_name, description, status) VALUES ($1, $2, $3)`,
                        [category_name, description || null, status]
                    );
                    insertedCount++;
                }
            } catch (err) {
                errors.push({ row: rowNumber, error: err.message });
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Success', summary: { totalRows: rawBody.length, inserted: insertedCount, updated: updatedCount, failed: errors.length }, errors: errors.length > 0 ? errors : null });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 3. CHANNELS ENDPOINTS
// ==========================================

// GET /api/channels
app.get('/api/channels', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM channels ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/channels/bulk
app.post('/api/channels/bulk', async (req, res) => {
    const rawBody = parseRaw2DArray(req.body);
    if (!Array.isArray(rawBody)) return res.status(400).json({ error: 'Expected an array' });

    const client = await pool.connect();
    try {
        let insertedCount = 0;
        let updatedCount = 0;
        let errors = [];

        await client.query('BEGIN');

        for (let index = 0; index < rawBody.length; index++) {
            const row = rawBody[index];
            const rowNumber = index + 1;

            const id = row.id || row.ID || row["ID (Only for updates)"];
            const channel_name = row.channel_name || row["Channel Name"] || row.ChannelName;
            const channel_code = row.channel_code || row["Channel Code (Only for updates)"] || row.ChannelCode;
            const description = row.description || row.Description;
            const status = row.status || row.Status || 'Active';

            if (!channel_name) {
                errors.push({ row: rowNumber, error: 'Channel Name is missing' });
                continue;
            }

            try {
                let matchFound = false;

                if (id && /^\d+$/.test(id)) {
                    const check = await client.query('SELECT id FROM channels WHERE id = $1', [id]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE channels SET channel_name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
                            [channel_name, description || null, status, id]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound && channel_code) {
                    const check = await client.query('SELECT id FROM channels WHERE channel_code = $1', [channel_code]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE channels SET channel_name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE channel_code = $4`,
                            [channel_name, description || null, status, channel_code]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    const check = await client.query('SELECT id FROM channels WHERE channel_name = $1', [channel_name]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE channels SET description = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE channel_name = $3`,
                            [description || null, status, channel_name]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    await client.query(
                        `INSERT INTO channels (channel_name, description, status) VALUES ($1, $2, $3)`,
                        [channel_name, description || null, status]
                    );
                    insertedCount++;
                }
            } catch (err) {
                errors.push({ row: rowNumber, error: err.message });
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Success', summary: { totalRows: rawBody.length, inserted: insertedCount, updated: updatedCount, failed: errors.length }, errors: errors.length > 0 ? errors : null });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 4. EMPLOYEES ENDPOINTS
// ==========================================

// GET /api/employees
app.get('/api/employees', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM employees ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees/bulk
app.post('/api/employees/bulk', async (req, res) => {
    const rawBody = parseRaw2DArray(req.body);
    if (!Array.isArray(rawBody)) return res.status(400).json({ error: 'Expected an array' });

    const client = await pool.connect();
    try {
        let insertedCount = 0;
        let updatedCount = 0;
        let errors = [];

        await client.query('BEGIN');

        for (let index = 0; index < rawBody.length; index++) {
            const row = rawBody[index];
            const rowNumber = index + 1;

            const id = row.id || row.ID || row["ID (Only for updates)"];
            const employee_name = row.employee_name || row["Employee Name"] || row.EmployeeName;
            const employee_code = row.employee_code || row["Employee Code (Only for updates)"] || row.EmployeeCode;
            const email = row.email || row.Email;
            const mobile = row.mobile || row.Mobile;
            const designation = row.designation || row.Designation;
            const status = row.status || row.Status || 'Active';

            if (!employee_name) {
                errors.push({ row: rowNumber, error: 'Employee Name is missing' });
                continue;
            }

            try {
                let matchFound = false;

                if (id && /^\d+$/.test(id)) {
                    const check = await client.query('SELECT id FROM employees WHERE id = $1', [id]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE employees SET employee_name = $1, email = $2, mobile = $3, designation = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
                            [employee_name, email || null, mobile || null, designation || null, status, id]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound && employee_code) {
                    const check = await client.query('SELECT id FROM employees WHERE employee_code = $1', [employee_code]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE employees SET employee_name = $1, email = $2, mobile = $3, designation = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE employee_code = $6`,
                            [employee_name, email || null, mobile || null, designation || null, status, employee_code]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    await client.query(
                        `INSERT INTO employees (employee_name, email, mobile, designation, status) VALUES ($1, $2, $3, $4, $5)`,
                        [employee_name, email || null, mobile || null, designation || null, status]
                    );
                    insertedCount++;
                }
            } catch (err) {
                errors.push({ row: rowNumber, error: err.message });
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Success', summary: { totalRows: rawBody.length, inserted: insertedCount, updated: updatedCount, failed: errors.length }, errors: errors.length > 0 ? errors : null });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 5. GST ENDPOINTS
// ==========================================

// GET /api/gst
app.get('/api/gst', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM gst ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/gst/bulk
app.post('/api/gst/bulk', async (req, res) => {
    const rawBody = parseRaw2DArray(req.body);
    if (!Array.isArray(rawBody)) return res.status(400).json({ error: 'Expected an array' });

    const client = await pool.connect();
    try {
        let insertedCount = 0;
        let updatedCount = 0;
        let errors = [];

        await client.query('BEGIN');

        for (let index = 0; index < rawBody.length; index++) {
            const row = rawBody[index];
            const rowNumber = index + 1;

            const id = row.id || row.ID || row["ID (Only for updates)"];
            const gst_name = row.gst_name || row["GST Name"] || row.GstName;
            const gst_rate = row.gst_rate || row["GST Rate"] || row.GstRate;
            const description = row.description || row.Description;
            const status = row.status || row.Status || 'Active';

            if (!gst_name || gst_rate === undefined || gst_rate === null) {
                errors.push({ row: rowNumber, error: 'GST Name and GST Rate are required' });
                continue;
            }

            try {
                let matchFound = false;

                if (id && /^\d+$/.test(id)) {
                    const check = await client.query('SELECT id FROM gst WHERE id = $1', [id]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE gst SET gst_name = $1, gst_rate = $2, description = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
                            [gst_name, parseFloat(gst_rate), description || null, status, id]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    const check = await client.query('SELECT id FROM gst WHERE gst_rate = $1 OR gst_name = $2', [parseFloat(gst_rate), gst_name]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE gst SET gst_name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
                            [gst_name, description || null, status, check.rows[0].id]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    await client.query(
                        `INSERT INTO gst (gst_name, gst_rate, description, status) VALUES ($1, $2, $3, $4)`,
                        [gst_name, parseFloat(gst_rate), description || null, status]
                    );
                    insertedCount++;
                }
            } catch (err) {
                errors.push({ row: rowNumber, error: err.message });
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Success', summary: { totalRows: rawBody.length, inserted: insertedCount, updated: updatedCount, failed: errors.length }, errors: errors.length > 0 ? errors : null });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 6. HSN CODE ENDPOINTS
// ==========================================

// GET /api/hsn
app.get('/api/hsn', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT h.*, g.gst_name 
            FROM hsn_codes h
            LEFT JOIN gst g ON h.gst_id = g.id
            ORDER BY h.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/hsn/bulk
app.post('/api/hsn/bulk', async (req, res) => {
    const rawBody = parseRaw2DArray(req.body);
    if (!Array.isArray(rawBody)) return res.status(400).json({ error: 'Expected an array' });

    const client = await pool.connect();
    try {
        let insertedCount = 0;
        let updatedCount = 0;
        let errors = [];

        await client.query('BEGIN');

        for (let index = 0; index < rawBody.length; index++) {
            const row = rawBody[index];
            const rowNumber = index + 1;

            const id = row.id || row.ID || row["ID (Only for updates)"];
            const hsn_code = row.hsn_code || row["HSN Code"] || row.HsnCode;
            const description = row.description || row.Description;
            const gst_id = row.gst_id || row["GST ID"] || row.GstId;
            const gst_rate = row.gst_rate || row["GST Rate"] || row.GstRate || 0.00;
            const status = row.status || row.Status || 'Active';

            if (!hsn_code) {
                errors.push({ row: rowNumber, error: 'HSN Code is missing' });
                continue;
            }

            try {
                let matchFound = false;
                let resolved_gst_id = gst_id ? parseInt(gst_id) : null;
                let final_gst_rate = parseFloat(gst_rate);

                // If gst_id is not provided but gst_rate is, try resolving from gst table
                if (!resolved_gst_id && final_gst_rate > 0) {
                    const checkGst = await client.query('SELECT id FROM gst WHERE gst_rate = $1 LIMIT 1', [final_gst_rate]);
                    if (checkGst.rows.length > 0) {
                        resolved_gst_id = checkGst.rows[0].id;
                    }
                }

                if (id && /^\d+$/.test(id)) {
                    const check = await client.query('SELECT id FROM hsn_codes WHERE id = $1', [id]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE hsn_codes SET hsn_code = $1, description = $2, gst_id = $3, gst_rate = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
                            [hsn_code, description || null, resolved_gst_id, final_gst_rate, status, id]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    const check = await client.query('SELECT id FROM hsn_codes WHERE hsn_code = $1', [hsn_code]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE hsn_codes SET description = $1, gst_id = $2, gst_rate = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE hsn_code = $5`,
                            [description || null, resolved_gst_id, final_gst_rate, status, hsn_code]
                        );
                        updatedCount++;
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    await client.query(
                        `INSERT INTO hsn_codes (hsn_code, description, gst_id, gst_rate, status) VALUES ($1, $2, $3, $4, $5)`,
                        [hsn_code, description || null, resolved_gst_id, final_gst_rate, status]
                    );
                    insertedCount++;
                }
            } catch (err) {
                errors.push({ row: rowNumber, error: err.message });
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Success', summary: { totalRows: rawBody.length, inserted: insertedCount, updated: updatedCount, failed: errors.length }, errors: errors.length > 0 ? errors : null });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
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
