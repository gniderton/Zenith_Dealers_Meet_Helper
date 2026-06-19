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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
        case 'routes':
        case 'route':
            templateData = [{
                "ID (Only for updates)": "",
                "Route Name": "Route A",
                "Description": "Optional description",
                "Service Day": "Monday",
                "Is Active": "Yes"
            }];
            break;
        case 'customers':
        case 'customer':
            templateData = [{
                "ID (Only for updates)": "",
                "Customer Name": "A B Store",
                "Customer Phone": "9876543210",
                "Email": "store@example.com",
                "GSTIN": "32ABCDE1234F1Z1",
                "PAN": "ABCDE1234F",
                "Route Name": "Route A",
                "Employee Name": "John Doe",
                "Channel Name": "General Trade",
                "WhatsApp Number": "9876543210",
                "Credit Limit": 50000.00,
                "Credit Days": 30,
                "Default Price Tier": "Dealer",
                "Latitude": 11.256,
                "Longitude": 75.782,
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
    } else if (entity === 'routes' || entity === 'route') {
        queryStr = 'SELECT * FROM routes ORDER BY route_name ASC';
    } else if (entity === 'customers' || entity === 'customer') {
        queryStr = `
            SELECT c.*, r.route_name, e.employee_name as employee_name, e.employee_name as dse_name, ch.channel_name
            FROM customers c
            LEFT JOIN routes r ON c.route_id = r.id
            LEFT JOIN employees e ON c.employee_id = e.id
            LEFT JOIN channels ch ON c.channel_id = ch.id
            ORDER BY c.customer_name ASC
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
                } else if (entity === 'routes' || entity === 'route') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const route_name = row.route_name || row["Route Name"];
                    const description = row.description || row.Description;
                    const rawActive = row.is_active || row["Is Active"] || row.status || row.Status;
                    const status = (rawActive === 'Yes' || rawActive === true || rawActive === 'true' || rawActive === 1 || rawActive === '1' || String(rawActive).toLowerCase() === 'active') ? 'Active' : 'Inactive';

                    if (!route_name) throw new Error('Route Name is missing');

                    try {
                        await client.query("SELECT setval('routes_id_seq', COALESCE(max(id), 1)) FROM routes");
                    } catch(e) {}

                    let matchFound = false;
                    if (id && /^\d+$/.test(id)) {
                        const check = await client.query('SELECT id FROM routes WHERE id = $1', [id]);
                        if (check.rows.length > 0) {
                            await client.query(
                                `UPDATE routes SET route_name = $1, description = $2, status = $3 WHERE id = $4`,
                                [route_name, description || null, status, id]
                            );
                            updatedCount++;
                            matchFound = true;
                        }
                    }
                    if (!matchFound) {
                        const check = await client.query('SELECT id FROM routes WHERE route_name = $1', [route_name]);
                        if (check.rows.length > 0) {
                            await client.query(
                                `UPDATE routes SET description = $1, status = $2 WHERE route_name = $3`,
                                [description || null, status, route_name]
                            );
                            updatedCount++;
                            matchFound = true;
                        }
                    }
                    if (!matchFound) {
                        await client.query(
                            `INSERT INTO routes (route_name, description, status) VALUES ($1, $2, $3)`,
                            [route_name, description || null, status]
                        );
                        insertedCount++;
                    }
                } else if (entity === 'customers' || entity === 'customer') {
                    const id = row.id || row.ID || row["ID (Only for updates)"];
                    const customer_name = row.customer_name || row["Customer Name"] || row["Customer"];
                    const customer_phone = row.customer_phone || row["Customer Phone"] || row["Phone Number"];
                    const email = row.email || row.Email;
                    const gstin = row.gstin || row.GSTIN || row["GST"];
                    const pan = row.pan || row.PAN;
                    const route_name = row.route_name || row["Route Name"] || row["Area"] || row["Route"];
                    const employee_name = row.employee_name || row["Employee Name"] || row.dse_name || row["Employee"];
                    const channel_name = row.channel_name || row["Channel Name"] || row["Channel"];
                    const whatsapp_number = row.whatsapp_number || row["WhatsApp Number"] || row["Phone Number"];

                    const address_line1 = row.address_line1 || row["Address"] || row["Address Line 1"];
                    const address_line2 = row.address_line2 || row["Address Line 2"];
                    const city = row.city || row["City"];
                    const state = row.state || row["State"];
                    const pincode = row.pincode || row["Pin Code"] || row["Pincode"];

                    const parseNum = (val, defaultVal) => {
                        if (val === null || val === undefined || val === '') return defaultVal;
                        const parsed = parseFloat(val);
                        return isNaN(parsed) ? defaultVal : parsed;
                    };

                    const latitude = parseNum(row.latitude || row["Latitude"], null);
                    const longitude = parseNum(row.longitude || row["Longitude"], null);
                    
                    const rawActive = row.is_active || row["Is Active"];
                    const is_active = rawActive !== undefined ? (rawActive === 'Yes' || rawActive === true || rawActive === 'true' || rawActive === 1 || rawActive === '1' || String(rawActive).toLowerCase() === 'active') : true;

                    if (!customer_name) throw new Error('Customer Name is missing');

                    // Resolve IDs
                    let route_id = null;
                    if (route_name) {
                        const check = await client.query('SELECT id FROM routes WHERE route_name = $1 LIMIT 1', [route_name]);
                        if (check.rows.length > 0) {
                            route_id = check.rows[0].id;
                        } else {
                            try {
                                const newRoute = await client.query(
                                    'INSERT INTO routes (route_name, status) VALUES ($1, $2) RETURNING id',
                                    [route_name, 'Active']
                                );
                                route_id = newRoute.rows[0].id;
                            } catch (e) {
                                const check2 = await client.query('SELECT id FROM routes WHERE route_name = $1 LIMIT 1', [route_name]);
                                if (check2.rows.length > 0) route_id = check2.rows[0].id;
                            }
                        }
                    }
                    let dse_id = null;
                    if (employee_name) {
                        const check = await client.query('SELECT id FROM employees WHERE employee_name = $1 LIMIT 1', [employee_name]);
                        if (check.rows.length > 0) {
                            dse_id = check.rows[0].id;
                        } else {
                            try {
                                const newEmp = await client.query(
                                    "INSERT INTO employees (employee_name, status) VALUES ($1, 'Active') RETURNING id",
                                    [employee_name]
                                );
                                dse_id = newEmp.rows[0].id;
                            } catch (e) {
                                const check2 = await client.query('SELECT id FROM employees WHERE employee_name = $1 LIMIT 1', [employee_name]);
                                if (check2.rows.length > 0) dse_id = check2.rows[0].id;
                            }
                        }
                    }
                    let channel_id = null;
                    if (channel_name) {
                        const check = await client.query('SELECT id FROM channels WHERE channel_name = $1 LIMIT 1', [channel_name]);
                        if (check.rows.length > 0) {
                            channel_id = check.rows[0].id;
                        } else {
                            try {
                                const newChannel = await client.query(
                                    "INSERT INTO channels (channel_name, channel_code, status) VALUES ($1, $2, 'Active') RETURNING id",
                                    [channel_name, channel_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()]
                                );
                                channel_id = newChannel.rows[0].id;
                            } catch (e) {
                                const check2 = await client.query('SELECT id FROM channels WHERE channel_name = $1 LIMIT 1', [channel_name]);
                                if (check2.rows.length > 0) channel_id = check2.rows[0].id;
                            }
                        }
                    }

                    let matchFound = false;
                    if (id && /^\d+$/.test(id)) {
                        const check = await client.query('SELECT id FROM customers WHERE id = $1', [id]);
                        if (check.rows.length > 0) {
                            await client.query(
                                `UPDATE customers SET 
                                    customer_name = $1, customer_phone = $2, email = $3, gstin = $4, pan = $5,
                                    route_id = $6, employee_id = $7, channel_id = $8, whatsapp_number = $9,
                                    location_lat = $10, location_lng = $11, is_active = $12,
                                    address_line1 = $13, address_line2 = $14, city = $15, state = $16, pincode = $17,
                                    updated_at = CURRENT_TIMESTAMP
                                 WHERE id = $18`,
                                [customer_name, customer_phone || null, email || null, gstin || null, pan || null, route_id, dse_id, channel_id, whatsapp_number || null, latitude, longitude, is_active, address_line1 || null, address_line2 || null, city || null, state || null, pincode || null, id]
                            );
                            updatedCount++;
                            matchFound = true;
                        }
                    }
                    if (!matchFound) {
                        const check = await client.query('SELECT id FROM customers WHERE customer_name = $1', [customer_name]);
                        if (check.rows.length > 0) {
                            await client.query(
                                `UPDATE customers SET 
                                    customer_phone = $1, email = $2, gstin = $3, pan = $4,
                                    route_id = $5, employee_id = $6, channel_id = $7, whatsapp_number = $8,
                                    location_lat = $9, location_lng = $10, is_active = $11,
                                    address_line1 = $12, address_line2 = $13, city = $14, state = $15, pincode = $16,
                                    updated_at = CURRENT_TIMESTAMP
                                 WHERE customer_name = $17`,
                                [customer_phone || null, email || null, gstin || null, pan || null, route_id, dse_id, channel_id, whatsapp_number || null, latitude, longitude, is_active, address_line1 || null, address_line2 || null, city || null, state || null, pincode || null, customer_name]
                            );
                            updatedCount++;
                            matchFound = true;
                        }
                    }
                    if (!matchFound) {
                        await client.query(
                            `INSERT INTO customers (
                                customer_name, customer_phone, email, gstin, pan,
                                route_id, employee_id, channel_id, whatsapp_number,
                                location_lat, location_lng, is_active,
                                address_line1, address_line2, city, state, pincode
                             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                            [customer_name, customer_phone || null, email || null, gstin || null, pan || null, route_id, dse_id, channel_id, whatsapp_number || null, latitude, longitude, is_active, address_line1 || null, address_line2 || null, city || null, state || null, pincode || null]
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
    } else if (entity === 'routes' || entity === 'route') {
        tableName = 'routes';
    } else if (entity === 'customers' || entity === 'customer') {
        tableName = 'customers';
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

// ==========================================
// DEALERS MEET EVENT ENDPOINTS
// ==========================================

// GET all customers for check-in lookup
app.get('/api/meet/customers/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.customer_name, c.customer_code, r.route_name,
                   CASE WHEN ec.id IS NOT NULL THEN true ELSE false END as is_checked_in,
                   ec.status as checkin_status
            FROM customers c
            LEFT JOIN routes r ON c.route_id = r.id
            LEFT JOIN event_checkins ec ON c.id = ec.customer_id
            ORDER BY c.customer_name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET arrived but unassigned check-ins (customer checked in but not yet assigned to employee)
app.get('/api/meet/checkins/unassigned', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ec.id as checkin_id, 
                c.id as customer_id,
                c.customer_name, 
                c.customer_code, 
                ec.status, 
                ec.checked_in_at,
                ec.required_materials,
                ec.visitor_name,
                ec.contact_number,
                ec.no_of_people,
                ec.vehicle_number,
                ec.badge_number,
                ec.checkin_notes
            FROM event_checkins ec
            JOIN customers c ON ec.customer_id = c.id
            WHERE ec.status = 'Arrived'
            ORDER BY ec.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET available employees
app.get('/api/meet/employees/available', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, employee_name, employee_code, status 
            FROM employees 
            WHERE status = 'Active' 
            ORDER BY employee_name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET active engaged pairs (Arrived and Engaged)
app.get('/api/meet/checkins/active', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ec.id as checkin_id, 
                c.id as customer_id,
                c.customer_name, 
                c.customer_code, 
                ec.status, 
                ec.checked_in_at, 
                ec.assigned_at,
                e.id as employee_id,
                e.employee_name as assigned_employee,
                ec.required_materials,
                ec.visitor_name,
                ec.contact_number,
                ec.no_of_people,
                ec.vehicle_number,
                ec.badge_number,
                ec.checkin_notes
            FROM event_checkins ec
            JOIN customers c ON ec.customer_id = c.id
            LEFT JOIN employees e ON ec.employee_id = e.id
            WHERE ec.status = 'Engaged'
            ORDER BY ec.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET completed sessions (customer completed order and checkout)
app.get('/api/meet/checkins/completed', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ec.id as checkin_id, 
                c.id as customer_id,
                c.customer_name, 
                c.customer_code, 
                ec.status, 
                ec.checked_in_at, 
                ec.assigned_at,
                ec.completed_at,
                e.id as employee_id,
                e.employee_name as assigned_employee,
                ec.required_materials,
                ec.feedback,
                ec.gifts_collected,
                ec.visitor_name,
                ec.contact_number,
                ec.no_of_people,
                ec.vehicle_number,
                ec.badge_number,
                ec.checkin_notes,
                (SELECT total_amount FROM meet_orders WHERE customer_id = c.id ORDER BY synced_at DESC LIMIT 1) as total_amount
            FROM event_checkins ec
            JOIN customers c ON ec.customer_id = c.id
            LEFT JOIN employees e ON ec.employee_id = e.id
            WHERE ec.status = 'Completed'
            ORDER BY ec.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET sessions ready for checkout (order synced but not completed)
app.get('/api/meet/checkins/ready', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ec.id as checkin_id, 
                c.id as customer_id,
                c.customer_name, 
                c.customer_code, 
                ec.status, 
                ec.checked_in_at, 
                ec.assigned_at,
                e.id as employee_id,
                e.employee_name as assigned_employee,
                ec.required_materials,
                ec.visitor_name,
                ec.contact_number,
                ec.no_of_people,
                ec.vehicle_number,
                ec.badge_number,
                ec.checkin_notes,
                (SELECT total_amount FROM meet_orders WHERE customer_id = c.id ORDER BY synced_at DESC LIMIT 1) as total_amount
            FROM event_checkins ec
            JOIN customers c ON ec.customer_id = c.id
            LEFT JOIN employees e ON ec.employee_id = e.id
            WHERE ec.status = 'Ready for Checkout'
            ORDER BY ec.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET meet event settings for branding
app.get('/api/meet/settings', async (req, res) => {
    try {
        const result = await pool.query('SELECT key, value FROM meet_settings');
        const settingsObj = {};
        result.rows.forEach(row => {
            settingsObj[row.key] = row.value;
        });
        res.json(settingsObj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET aggregated order details and visit metrics by checkin_id for PDF print
app.get('/api/meet/orders/by-checkin/:checkin_id', async (req, res) => {
    const { checkin_id } = req.params;
    try {
        const checkinQuery = await pool.query(`
            SELECT 
                ec.id as checkin_id,
                ec.checked_in_at,
                ec.assigned_at,
                ec.completed_at,
                ec.visitor_name,
                ec.contact_number,
                ec.no_of_people,
                ec.vehicle_number,
                ec.badge_number,
                ec.checkin_notes,
                c.customer_name,
                c.customer_code,
                c.customer_phone,
                c.gstin,
                r.route_name as route,
                e.employee_name as assigned_employee,
                (SELECT employee_name FROM employees WHERE id = c.employee_id) as default_employee,
                mo.id as order_id,
                mo.total_amount
            FROM event_checkins ec
            JOIN customers c ON ec.customer_id = c.id
            LEFT JOIN routes r ON c.route_id = r.id
            LEFT JOIN employees e ON ec.employee_id = e.id
            LEFT JOIN meet_orders mo ON c.id = mo.customer_id
            WHERE ec.id = $1
            LIMIT 1
        `, [checkin_id]);

        if (checkinQuery.rowCount === 0) {
            return res.status(404).json({ error: 'Check-in session not found' });
        }

        const orderInfo = checkinQuery.rows[0];

        let items = [];
        if (orderInfo.order_id) {
            const itemsQuery = await pool.query(`
                SELECT 
                    moi.id as line_id,
                    p.product_name,
                    p.uom,
                    moi.quantity,
                    moi.rate,
                    moi.amount
                FROM meet_order_items moi
                JOIN products p ON moi.product_id = p.id
                WHERE moi.order_id = $1
                ORDER BY p.product_name ASC
            `, [orderInfo.order_id]);
            items = itemsQuery.rows;
        }

        res.json({
            ...orderInfo,
            items: items
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Check-in customer
app.post('/api/meet/checkin', async (req, res) => {
    const { 
        customer_id, 
        required_materials, 
        visitor_name, 
        contact_number, 
        no_of_people, 
        vehicle_number, 
        badge_number, 
        checkin_notes 
    } = req.body;
    
    if (!customer_id) {
        return res.status(400).json({ error: 'customer_id is required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO event_checkins (
                customer_id, required_materials, visitor_name, contact_number, 
                no_of_people, vehicle_number, badge_number, checkin_notes, status
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Arrived') RETURNING *`,
            [
                customer_id, 
                required_materials || null, 
                visitor_name || null, 
                contact_number || null, 
                parseInt(no_of_people) || 1, 
                vehicle_number || null, 
                badge_number || null, 
                checkin_notes || null
            ]
        );
        res.json({ success: true, checkin: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Assign employee to customer
app.post('/api/meet/assign', async (req, res) => {
    const { checkin_id, employee_id } = req.body;
    if (!checkin_id || !employee_id) {
        return res.status(400).json({ error: 'checkin_id and employee_id are required' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Update checkin status
        const checkinUpdate = await client.query(
            `UPDATE event_checkins 
             SET employee_id = $1, status = 'Engaged', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`,
            [employee_id, checkin_id]
        );

        if (checkinUpdate.rowCount === 0) {
            throw new Error('Checkin record not found');
        }

        // 2. Set employee status to Engaged
        await client.query(
            `UPDATE employees SET status = 'Engaged', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [employee_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, checkin: checkinUpdate.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 3. Sync punched order from mobile and free up the employee
app.post('/api/meet/orders', async (req, res) => {
    console.log("POST /api/meet/orders received body:", JSON.stringify(req.body, null, 2));
    const { customer_id, employee_id, items } = req.body;
    if (!customer_id || !employee_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'customer_id, employee_id, and non-empty items array are required' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Calculate total order amount
        let total = 0;
        for (const item of items) {
            const qty = parseInt(item.quantity) || 0;
            const rate = parseFloat(item.rate) || 0;
            total += qty * rate;
        }

        // 2. Insert order header
        const orderRes = await client.query(
            `INSERT INTO meet_orders (customer_id, employee_id, total_amount) 
             VALUES ($1, $2, $3) RETURNING id`,
            [customer_id, employee_id, total]
        );
        const orderId = orderRes.rows[0].id;

        // 3. Insert order lines
        for (const item of items) {
            const qty = parseInt(item.quantity) || 0;
            const rate = parseFloat(item.rate) || 0;
            const amount = qty * rate;
            await client.query(
                `INSERT INTO meet_order_items (order_id, product_id, quantity, rate, amount)
                 VALUES ($1, $2, $3, $4, $5)`,
                [orderId, item.product_id, qty, rate, amount]
            );
        }

        // 4. Update checkin status to 'Ready for Checkout'
        await client.query(
            `UPDATE event_checkins 
             SET status = 'Ready for Checkout', updated_at = CURRENT_TIMESTAMP 
             WHERE customer_id = $1 AND employee_id = $2 AND status = 'Engaged'`,
            [customer_id, employee_id]
        );

        // 5. Free up employee (make them Active again)
        await client.query(
            `UPDATE employees SET status = 'Active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [employee_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, orderId: orderId, totalAmount: total });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 4. Checkout completion from the counter
app.post('/api/meet/complete', async (req, res) => {
    const { checkin_id, feedback, gifts_collected } = req.body;
    if (!checkin_id) {
        return res.status(400).json({ error: 'checkin_id is required' });
    }
    try {
        const result = await pool.query(
            `UPDATE event_checkins 
             SET status = 'Completed', feedback = $1, gifts_collected = $2, 
                 completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 RETURNING *`,
            [feedback || null, gifts_collected === true, checkin_id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Checkin record not found' });
        }
        res.json({ success: true, checkin: result.rows[0] });
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
