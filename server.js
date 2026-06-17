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

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Test Connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Supabase Connection Error:', err.message);
    } else {
        console.log('⚡ Supabase Connection Successful at:', res.rows[0].now);
    }
});

// Helper: Parse raw Appsmith 2D array format to clean JSON array
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

// Health route
app.get('/health', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date() });
});

// ==========================================
// DYNAMIC TEMPLATE DOWNLOAD ENDPOINT
// ==========================================
app.get('/api/:entity/template', (req, res) => {
    const entity = req.params.entity.toLowerCase().replace(/[\s_-]/g, '');
    let templateData = [];

    switch (entity) {
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
        case 'hsncode':
        case 'hsncodes':
            templateData = [{
                "ID (Only for updates)": "",
                "HSN Code": "84713010",
                "Description": "Laptop computers",
                "GST ID": "",
                "GST Rate": 18.00,
                "Status": "Active"
            }];
            break;
        case 'products':
        case 'product':
            templateData = [{
                "ID (Only for updates)": "",
                "Brand Name": "Example Brand",
                "Category Name": "Example Category",
                "Product Name": "DM_FRUIT DRINKS_GREEN APPLE_240_ML",
                "EAN Code": "8901246005977",
                "HSN Code": "84713010",
                "MRP": 50.00,
                "GST Rate": 18.00,
                "Purchase Rate": 24.55861,
                "Distributor Rate": 38.10000,
                "Wholesale Rate": 38.10000,
                "Dealer Rate": 38.10000,
                "Retail Rate": 47.62000,
                "Case Quantity": 24,
                "UOM": "Pcs",
                "Is Active": "Yes"
            }];
            break;
        default:
            return res.status(400).json({ error: `Template for entity '${req.params.entity}' is not supported.` });
    }

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        XLSX.utils.book_append_sheet(wb, ws, `${req.params.entity} Template`);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="${req.params.entity.toLowerCase().replace(/[\s_-]/g, '_')}_template.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate template: ' + err.message });
    }
});

// ==========================================
// DYNAMIC GET ENDPOINT FOR ALL ENTITIES
// ==========================================
app.get('/api/:entity', async (req, res) => {
    const entity = req.params.entity.toLowerCase().replace(/[\s_-]/g, '');
    let queryStr = '';

    if (entity === 'brands' || entity === 'brand') {
        queryStr = 'SELECT * FROM brands ORDER BY id DESC';
    } else if (entity === 'categories' || entity === 'category') {
        queryStr = 'SELECT * FROM categories ORDER BY id DESC';
    } else if (entity === 'channel' || entity === 'channels') {
        queryStr = 'SELECT * FROM channels ORDER BY id DESC';
    } else if (entity === 'employees' || entity === 'employee') {
        queryStr = 'SELECT * FROM employees ORDER BY id DESC';
    } else if (entity === 'gst') {
        queryStr = 'SELECT * FROM gst ORDER BY id DESC';
    } else if (entity === 'hsn' || entity === 'hsncode' || entity === 'hsncodes') {
        queryStr = `
            SELECT h.*, g.gst_name 
            FROM hsn_codes h
            LEFT JOIN gst g ON h.gst_id = g.id
            ORDER BY h.id DESC
        `;
    } else if (entity === 'products' || entity === 'product') {
        queryStr = `
            SELECT p.*, b.brand_name, c.category_name, h.hsn_code, g.gst_name as tax_name 
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN hsn_codes h ON p.hsn_id = h.id
            LEFT JOIN gst g ON p.tax_id = g.id
            ORDER BY p.id DESC
        `;
    } else {
        return res.status(400).json({ error: `Unsupported entity: ${req.params.entity}` });
    }

    try {
        const result = await pool.query(queryStr);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// DYNAMIC BULK POST ENDPOINT FOR ALL ENTITIES
// ==========================================
app.post('/api/:entity/bulk', async (req, res) => {
    const entity = req.params.entity.toLowerCase().replace(/[\s_-]/g, '');
    const rawBody = parseRaw2DArray(req.body);
    if (!Array.isArray(rawBody)) {
        return res.status(400).json({ error: 'Expected a JSON array of objects' });
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

            try {
                if (entity === 'brands' || entity === 'brand') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const brand_name = row.brand_name || row["Brand Name"] || row.BrandName;
                    const brand_code = row.brand_code || row["Brand Code (Only for updates)"] || row.BrandCode;
                    const description = row.description || row.Description;
                    const logo_url = row.logo_url || row["Logo URL"] || row.LogoUrl;
                    const status = row.status || row.Status || 'Active';

                    if (!brand_name) throw new Error('Brand Name is missing');

                    let matchFound = false;
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
                    if (!matchFound) {
                        await client.query(
                            `INSERT INTO brands (brand_name, description, logo_url, status) VALUES ($1, $2, $3, $4)`,
                            [brand_name, description || null, logo_url || null, status]
                        );
                        insertedCount++;
                    }

                } else if (entity === 'categories' || entity === 'category') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const category_name = row.category_name || row["Category Name"] || row.CategoryName;
                    const category_code = row.category_code || row["Category Code (Only for updates)"] || row.CategoryCode;
                    const description = row.description || row.Description;
                    const status = row.status || row.Status || 'Active';

                    if (!category_name) throw new Error('Category Name is missing');

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

                } else if (entity === 'channel' || entity === 'channels') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const channel_name = row.channel_name || row["Channel Name"] || row.ChannelName;
                    const channel_code = row.channel_code || row["Channel Code (Only for updates)"] || row.ChannelCode;
                    const description = row.description || row.Description;
                    const status = row.status || row.Status || 'Active';

                    if (!channel_name) throw new Error('Channel Name is missing');

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

                } else if (entity === 'employees' || entity === 'employee') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const employee_name = row.employee_name || row["Employee Name"] || row.EmployeeName;
                    const employee_code = row.employee_code || row["Employee Code (Only for updates)"] || row.EmployeeCode;
                    const email = row.email || row.Email;
                    const mobile = row.mobile || row.Mobile;
                    const designation = row.designation || row.Designation;
                    const status = row.status || row.Status || 'Active';

                    if (!employee_name) throw new Error('Employee Name is missing');

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

                } else if (entity === 'gst') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const gst_name = row.gst_name || row["GST Name"] || row.GstName;
                    const gst_rate = row.gst_rate || row["GST Rate"] || row.GstRate;
                    const description = row.description || row.Description;
                    const status = row.status || row.Status || 'Active';

                    if (!gst_name || gst_rate === undefined || gst_rate === null) throw new Error('GST Name and GST Rate are required');

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

                } else if (entity === 'hsn' || entity === 'hsncode' || entity === 'hsncodes') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const hsn_code = row.hsn_code || row["HSN Code"] || row.HsnCode;
                    const description = row.description || row.Description;
                    const gst_id = row.gst_id || row["GST ID"] || row.GstId;
                    const gst_rate = row.gst_rate || row["GST Rate"] || row.GstRate || 0.00;
                    const status = row.status || row.Status || 'Active';

                    if (!hsn_code) throw new Error('HSN Code is missing');

                    let matchFound = false;
                    let resolved_gst_id = gst_id ? parseInt(gst_id) : null;
                    let final_gst_rate = parseFloat(gst_rate);

                    if (!resolved_gst_id && final_gst_rate > 0) {
                        const checkGst = await client.query('SELECT id FROM gst WHERE gst_rate = $1 LIMIT 1', [final_gst_rate]);
                        if (checkGst.rows.length > 0) resolved_gst_id = checkGst.rows[0].id;
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
                } else if (entity === 'products' || entity === 'product') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const brand_name = row.brand_name || row["Brand Name"] || row.BrandName;
                    const category_name = row.category_name || row["Category Name"] || row.CategoryName;
                    const product_name = row.product_name || row["Product Name"] || row.ProductName;
                    const ean_code = row.ean_code || row["EAN Code"] || row.EanCode;
                    const hsn_code = row.hsn_code || row["HSN Code"] || row.HsnCode;
                    const mrp = row.mrp || row.MRP;
                    const gst_rate = row.gst_rate || row["GST Rate"] || row.GstRate;
                    const purchase_rate = row.purchase_rate || row["Purchase Rate"] || row.PurchaseRate;
                    const distributor_rate = row.distributor_rate || row["Distributor Rate"] || row.DistributorRate;
                    const wholesale_rate = row.wholesale_rate || row["Wholesale Rate"] || row.WholesaleRate;
                    const dealer_rate = row.dealer_rate || row["Dealer Rate"] || row.DealerRate;
                    const retail_rate = row.retail_rate || row["Retail Rate"] || row.RetailRate;
                    const case_quantity = row.case_quantity || row["Case Quantity"] || row.CaseQuantity || 1;
                    const uom = row.uom || row.UOM || 'Pcs';
                    
                    const rawActive = row.is_active || row["Is Active"] || row.IsActive;
                    const is_active = rawActive !== undefined ? (rawActive === 'Yes' || rawActive === true || rawActive === 'true' || rawActive === 1 || rawActive === '1') : true;

                    if (!product_name) throw new Error('Product Name is missing');

                    // Resolve Foreign Key IDs dynamically
                    let brand_id = null;
                    if (brand_name) {
                        const check = await client.query('SELECT id FROM brands WHERE brand_name = $1 LIMIT 1', [brand_name]);
                        if (check.rows.length > 0) brand_id = check.rows[0].id;
                    }

                    let category_id = null;
                    if (category_name) {
                        const check = await client.query('SELECT id FROM categories WHERE category_name = $1 LIMIT 1', [category_name]);
                        if (check.rows.length > 0) category_id = check.rows[0].id;
                    }

                    let hsn_id = null;
                    if (hsn_code) {
                        const check = await client.query('SELECT id FROM hsn_codes WHERE hsn_code = $1 LIMIT 1', [hsn_code]);
                        if (check.rows.length > 0) hsn_id = check.rows[0].id;
                    }

                    let tax_id = null;
                    if (gst_rate !== undefined) {
                        const check = await client.query('SELECT id FROM gst WHERE gst_rate = $1 LIMIT 1', [parseFloat(gst_rate)]);
                        if (check.rows.length > 0) tax_id = check.rows[0].id;
                    }

                    let matchFound = false;

                    if (id && /^\d+$/.test(id)) {
                        const check = await client.query('SELECT id FROM products WHERE id = $1', [id]);
                        if (check.rows.length > 0) {
                            await client.query(
                                `UPDATE products 
                                 SET brand_id = $1, category_id = $2, hsn_id = $3, tax_id = $4, product_name = $5, ean_code = $6, mrp = $7, purchase_rate = $8, distributor_rate = $9, wholesale_rate = $10, dealer_rate = $11, retail_rate = $12, case_quantity = $13, uom = $14, is_active = $15, updated_at = CURRENT_TIMESTAMP 
                                 WHERE id = $16`,
                                [brand_id, category_id, hsn_id, tax_id, product_name, ean_code || null, parseFloat(mrp || 0), parseFloat(purchase_rate || 0), parseFloat(distributor_rate || 0), parseFloat(wholesale_rate || 0), parseFloat(dealer_rate || 0), parseFloat(retail_rate || 0), parseInt(case_quantity), uom, is_active, id]
                            );
                            updatedCount++;
                            matchFound = true;
                        }
                    }
                    if (!matchFound) {
                        const check = await client.query('SELECT id FROM products WHERE product_name = $1', [product_name]);
                        if (check.rows.length > 0) {
                            await client.query(
                                `UPDATE products 
                                 SET brand_id = $1, category_id = $2, hsn_id = $3, tax_id = $4, ean_code = $5, mrp = $6, purchase_rate = $7, distributor_rate = $8, wholesale_rate = $9, dealer_rate = $10, retail_rate = $11, case_quantity = $12, uom = $13, is_active = $14, updated_at = CURRENT_TIMESTAMP 
                                 WHERE product_name = $15`,
                                [brand_id, category_id, hsn_id, tax_id, ean_code || null, parseFloat(mrp || 0), parseFloat(purchase_rate || 0), parseFloat(distributor_rate || 0), parseFloat(wholesale_rate || 0), parseFloat(dealer_rate || 0), parseFloat(retail_rate || 0), parseInt(case_quantity), uom, is_active, product_name]
                            );
                            updatedCount++;
                            matchFound = true;
                        }
                    }
                    if (!matchFound) {
                        await client.query(
                            `INSERT INTO products (brand_id, category_id, hsn_id, tax_id, product_name, ean_code, mrp, purchase_rate, distributor_rate, wholesale_rate, dealer_rate, retail_rate, case_quantity, uom, is_active) 
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                             [brand_id, category_id, hsn_id, tax_id, product_name, ean_code || null, parseFloat(mrp || 0), parseFloat(purchase_rate || 0), parseFloat(distributor_rate || 0), parseFloat(wholesale_rate || 0), parseFloat(dealer_rate || 0), parseFloat(retail_rate || 0), parseInt(case_quantity), uom, is_active]
                        );
                        insertedCount++;
                    }
                } else {
                    throw new Error(`Unsupported entity: ${req.params.entity}`);
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
// DYNAMIC DELETE ENDPOINT FOR ALL ENTITIES
// ==========================================
app.delete('/api/:entity', async (req, res) => {
    const entity = req.params.entity.toLowerCase().replace(/[\s_-]/g, '');
    const ids = req.body;
    
    if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'Expected a JSON array of IDs to delete' });
    }

    let tableName = '';
    if (entity === 'brands' || entity === 'brand') {
        tableName = 'brands';
    } else if (entity === 'categories' || entity === 'category') {
        tableName = 'categories';
    } else if (entity === 'channel' || entity === 'channels') {
        tableName = 'channels';
    } else if (entity === 'employees' || entity === 'employee') {
        tableName = 'employees';
    } else if (entity === 'gst') {
        tableName = 'gst';
    } else if (entity === 'hsn' || entity === 'hsncode' || entity === 'hsncodes') {
        tableName = 'hsn_codes';
    } else if (entity === 'products' || entity === 'product') {
        tableName = 'products';
    } else {
        return res.status(400).json({ error: `Unsupported entity: ${req.params.entity}` });
    }

    try {
        const result = await pool.query(`DELETE FROM ${tableName} WHERE id = ANY($1::int[]) RETURNING *`, [ids]);
        res.json({ message: `Successfully deleted ${result.rowCount} records`, deletedCount: result.rowCount, deleted: result.rows });
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
