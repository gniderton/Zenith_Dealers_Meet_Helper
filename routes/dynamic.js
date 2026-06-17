const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Helper to normalize entity name
function normalizeEntity(entity) {
    return String(entity).toLowerCase().replace(/[\s-_]/g, '');
}

// 1. Template Download (GET /api/:entity/template)
router.get('/:entity/template', async (req, res) => {
    const entity = normalizeEntity(req.params.entity);
    if (entity === 'routes' || entity === 'route') {
        return res.json(["ID (Only for updates)", "Route Name", "Description", "Service Day", "Is Active"]);
    } else if (entity === 'customers' || entity === 'customer') {
        return res.json([
            "ID (Only for updates)", "Customer Name", "Customer Phone", "Email", "GSTIN", "PAN", 
            "Route Name", "Employee Name", "Channel Name", "WhatsApp Number", "Credit Limit", 
            "Credit Days", "Default Price Tier", "Latitude", "Longitude", "Is Active"
        ]);
    } else if (entity === 'brands' || entity === 'brand') {
        return res.json(["ID (Only for updates)", "Brand Name", "Brand Code (Only for updates)", "Is Active"]);
    } else if (entity === 'categories' || entity === 'category') {
        return res.json(["ID (Only for updates)", "Category Name", "Category Code (Only for updates)", "Is Active"]);
    } else if (entity === 'channels' || entity === 'channel') {
        return res.json(["ID (Only for updates)", "Channel Name", "Channel Code (Only for updates)", "Price Column", "Is Active"]);
    } else if (entity === 'employees' || entity === 'employee') {
        return res.json(["ID (Only for updates)", "Full Name", "Phone", "Email", "Employee Code (Only for updates)", "Is Active"]);
    } else if (entity === 'hsncode' || entity === 'hsn' || entity === 'hsncodes') {
        return res.json(["ID (Only for updates)", "HSN Code", "Description", "Is Active"]);
    } else if (entity === 'gst' || entity === 'taxes' || entity === 'tax') {
        return res.json(["ID (Only for updates)", "GST Name", "Rate (%)", "Is Active"]);
    } else if (entity === 'products' || entity === 'product') {
        return res.json([
            "ID (Only for updates)", "Product Name", "Product Code (Only for updates)", "EAN Code", 
            "MRP", "Purchase Rate", "Distributor Rate", "Wholesale Rate", "Dealer Rate", 
            "Retail Rate", "Case Quantity", "UOM", "Is Active"
        ]);
    } else {
        return res.status(404).json({ error: `Template for entity '${req.params.entity}' not found` });
    }
});

// 2. GET /api/:entity
router.get('/:entity', async (req, res, next) => {
    const entity = normalizeEntity(req.params.entity);
    const handledEntities = ['routes', 'route', 'customers', 'customer'];
    if (!handledEntities.includes(entity)) {
        return next();
    }
    try {
        if (entity === 'routes' || entity === 'route') {
            const result = await pool.query('SELECT * FROM routes ORDER BY route_name ASC');
            return res.json(result.rows);
        } else if (entity === 'customers' || entity === 'customer') {
            const result = await pool.query(`
                SELECT 
                    c.*, 
                    r.route_name,
                    e.full_name as employee_name,
                    e.full_name as dse_name,
                    ch.channel_name
                FROM customers c
                LEFT JOIN routes r ON c.route_id = r.id
                LEFT JOIN employees e ON c.dse_id = e.id
                LEFT JOIN channels ch ON c.channel_id = ch.id
                ORDER BY c.customer_name ASC
            `);
            return res.json(result.rows);
        } else if (entity === 'brands' || entity === 'brand') {
            const result = await pool.query('SELECT * FROM brands ORDER BY brand_name ASC');
            return res.json(result.rows);
        } else if (entity === 'categories' || entity === 'category') {
            const result = await pool.query('SELECT * FROM categories ORDER BY category_name ASC');
            return res.json(result.rows);
        } else if (entity === 'channels' || entity === 'channel') {
            const result = await pool.query('SELECT * FROM channels ORDER BY id ASC');
            return res.json(result.rows);
        } else if (entity === 'employees' || entity === 'employee') {
            const result = await pool.query('SELECT * FROM employees ORDER BY full_name ASC');
            return res.json(result.rows);
        } else if (entity === 'hsncode' || entity === 'hsn' || entity === 'hsncodes') {
            const result = await pool.query('SELECT * FROM hsn_codes ORDER BY hsn_code ASC');
            return res.json(result.rows);
        } else if (entity === 'gst' || entity === 'taxes' || entity === 'tax') {
            const result = await pool.query('SELECT * FROM taxes ORDER BY tax_name ASC');
            return res.json(result.rows);
        } else if (entity === 'products' || entity === 'product') {
            const result = await pool.query(`
                SELECT p.*, b.brand_name, c.category_name, v.vendor_name
                FROM products p
                LEFT JOIN brands b ON p.brand_id = b.id
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN vendors v ON p.vendor_id = v.id
                ORDER BY p.product_name ASC
            `);
            return res.json(result.rows);
        } else {
            return res.status(404).json({ error: `Entity '${req.params.entity}' not found` });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// Helper for parsing raw data
function parseRaw2DArray(data) {
    if (!Array.isArray(data)) return [];
    if (data.length === 0) return [];
    if (!Array.isArray(data[0])) return data; // Already array of objects
    
    const headers = data[0].map(h => String(h).trim());
    const result = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        if (row.every(val => val === null || val === undefined || String(val).trim() === '')) {
            continue;
        }
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : null;
        });
        result.push(obj);
    }
    return result;
}

// 3. POST /api/:entity/bulk
router.post('/:entity/bulk', async (req, res, next) => {
    const entity = normalizeEntity(req.params.entity);
    const supportedEntities = [
        'routes', 'route', 'customers', 'customer',
        'brands', 'brand', 'categories', 'category', 'channels', 'channel'
    ];
    if (!supportedEntities.includes(entity)) {
        return next();
    }
    const rawData = req.body;
    
    let items;
    if (typeof rawData === 'object' && rawData !== null && rawData.items && Array.isArray(rawData.items)) {
        items = rawData.items;
    } else {
        items = parseRaw2DArray(rawData);
    }
    
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided for bulk upload' });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let processedCount = 0;
        
        if (entity === 'routes' || entity === 'route') {
            try {
                await client.query("SELECT setval('routes_id_seq', COALESCE(max(id), 1)) FROM routes");
            } catch (seqErr) {
                console.log("Could not resync routes sequence:", seqErr.message);
            }
            for (const item of items) {
                const id = item['ID (Only for updates)'] || item.id;
                const name = item['Route Name'] || item.route_name;
                const desc = item['Description'] || item.description;
                const service_day = item['Service Day'] || item.service_day;
                const is_active = item['Is Active'] !== undefined ? 
                    (item['Is Active'] === true || String(item['Is Active']).toLowerCase() === 'true' || String(item['Is Active']).toLowerCase() === 'active') : true;
                
                if (!name) continue;
                
                if (id) {
                    await client.query(`
                        UPDATE routes SET route_name = $1, description = $2, service_day = $3, is_active = $4
                        WHERE id = $5
                    `, [name, desc, service_day, is_active, id]);
                } else {
                    await client.query(`
                        INSERT INTO routes (route_name, description, service_day, is_active)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (route_name) DO UPDATE SET description = EXCLUDED.description, service_day = EXCLUDED.service_day, is_active = EXCLUDED.is_active
                    `, [name, desc, service_day, is_active]);
                }
                processedCount++;
            }
        } else if (entity === 'customers' || entity === 'customer') {
            // Pre-fetch relation mapping for route name, employee name, and channel name
            const routesRes = await client.query('SELECT id, route_name FROM routes');
            const empRes = await client.query('SELECT id, full_name FROM employees');
            const chanRes = await client.query('SELECT id, channel_name FROM channels');
            
            const routeMap = {};
            routesRes.rows.forEach(r => routeMap[r.route_name.toLowerCase().trim()] = r.id);
            
            const empMap = {};
            empRes.rows.forEach(e => empMap[e.full_name.toLowerCase().trim()] = e.id);
            
            const chanMap = {};
            chanRes.rows.forEach(c => chanMap[c.channel_name.toLowerCase().trim()] = c.id);
            
            for (const item of items) {
                const id = item['ID (Only for updates)'] || item.id;
                const name = item['Customer Name'] || item.customer_name;
                const phone = item['Customer Phone'] || item.customer_phone;
                const email = item['Email'] || item.email;
                const gstin = item['GSTIN'] || item.gstin;
                const pan = item['PAN'] || item.pan;
                const whatsapp = item['WhatsApp Number'] || item.whatsapp_number;
                
                const routeName = item['Route Name'] || item.route_name;
                const routeId = routeName ? routeMap[String(routeName).toLowerCase().trim()] : null;
                
                const empName = item['Employee Name'] || item.employee_name || item.dse_name;
                const dseId = empName ? empMap[String(empName).toLowerCase().trim()] : null;
                
                const chanName = item['Channel Name'] || item.channel_name;
                const channelId = chanName ? chanMap[String(chanName).toLowerCase().trim()] : null;
                
                const creditLimit = parseFloat(item['Credit Limit'] || item.credit_limit) || 0;
                const creditDays = parseInt(item['Credit Days'] || item.credit_days) || 0;
                const defaultPriceTier = item['Default Price Tier'] || item.default_price_tier || 'Dealer';
                const lat = parseFloat(item['Latitude'] || item.latitude) || null;
                const lng = parseFloat(item['Longitude'] || item.longitude) || null;
                
                const is_active = item['Is Active'] !== undefined ? 
                    (item['Is Active'] === true || String(item['Is Active']).toLowerCase() === 'true' || String(item['Is Active']).toLowerCase() === 'active') : true;
                
                if (!name) continue;
                
                if (id) {
                    await client.query(`
                        UPDATE customers SET 
                            customer_name = $1, customer_phone = $2, email = $3, gstin = $4, pan = $5,
                            route_id = $6, dse_id = $7, channel_id = $8, whatsapp_number = $9,
                            credit_limit = $10, credit_days = $11, default_price_tier = $12,
                            latitude = $13, longitude = $14, is_active = $15
                        WHERE id = $16
                    `, [name, phone, email, gstin, pan, routeId, dseId, channelId, whatsapp, creditLimit, creditDays, defaultPriceTier, lat, lng, is_active, id]);
                } else {
                    // Generate customer code
                    // Update document_sequences
                    const seqRes = await client.query(`
                        UPDATE document_sequences SET current_number = current_number + 1 WHERE document_type = 'CUSTOMER' RETURNING prefix, current_number
                    `);
                    let custCode = '';
                    if (seqRes.rows.length > 0) {
                        custCode = `${seqRes.rows[0].prefix || ''}${String(seqRes.rows[0].current_number).padStart(4, '0')}`;
                    } else {
                        // Fallback
                        custCode = `CUST-${Date.now().toString().substring(8)}`;
                    }
                    
                    await client.query(`
                        INSERT INTO customers (
                            customer_name, customer_phone, email, gstin, pan,
                            route_id, dse_id, channel_id, whatsapp_number,
                            credit_limit, credit_days, default_price_tier,
                            latitude, longitude, is_active, customer_code
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    `, [name, phone, email, gstin, pan, routeId, dseId, channelId, whatsapp, creditLimit, creditDays, defaultPriceTier, lat, lng, is_active, custCode]);
                }
                processedCount++;
            }
        } else {
            // For brands, categories, channels, etc., do generic bulk import
            const tableMap = {
                brands: { table: 'brands', nameCol: 'brand_name', codeCol: 'brand_code' },
                brand: { table: 'brands', nameCol: 'brand_name', codeCol: 'brand_code' },
                categories: { table: 'categories', nameCol: 'category_name', codeCol: 'category_code' },
                category: { table: 'categories', nameCol: 'category_name', codeCol: 'category_code' },
                channels: { table: 'channels', nameCol: 'channel_name', codeCol: 'channel_code' },
                channel: { table: 'channels', nameCol: 'channel_name', codeCol: 'channel_code' }
            };
            
            const mapping = tableMap[entity];
            if (mapping) {
                for (const item of items) {
                    const id = item['ID (Only for updates)'] || item.id;
                    const name = item[item['Brand Name'] ? 'Brand Name' : item['Category Name'] ? 'Category Name' : item['Channel Name'] ? 'Channel Name' : mapping.nameCol] || item[mapping.nameCol];
                    const code = item['Brand Code (Only for updates)'] || item['Category Code (Only for updates)'] || item['Channel Code (Only for updates)'] || item[mapping.codeCol];
                    const is_active = item['Is Active'] !== undefined ? 
                        (item['Is Active'] === true || String(item['Is Active']).toLowerCase() === 'true' || String(item['Is Active']).toLowerCase() === 'active') : true;
                    
                    if (!name) continue;
                    
                    if (id) {
                        await client.query(`
                            UPDATE ${mapping.table} SET ${mapping.nameCol} = $1, is_active = $2
                            WHERE id = $3
                        `, [name, is_active, id]);
                    } else {
                        const autoCode = code || name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
                        await client.query(`
                            INSERT INTO ${mapping.table} (${mapping.nameCol}, ${mapping.codeCol}, is_active)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (${mapping.nameCol}) DO UPDATE SET is_active = EXCLUDED.is_active
                        `, [name, autoCode, is_active]);
                    }
                    processedCount++;
                }
            } else {
                throw new Error(`Bulk upload not supported for entity: ${req.params.entity}`);
            }
        }
        
        await client.query('COMMIT');
        return res.json({ success: true, count: processedCount, message: `Successfully processed ${processedCount} items.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 4. Bulk DELETE (/api/:entity)
router.delete('/:entity', async (req, res, next) => {
    const entity = normalizeEntity(req.params.entity);
    
    const tableMap = {
        routes: 'routes', route: 'routes',
        customers: 'customers', customer: 'customers',
        brands: 'brands', brand: 'brands',
        categories: 'categories', category: 'categories',
        channels: 'channels', channel: 'channels',
        employees: 'employees', employee: 'employees',
        products: 'products', product: 'products',
        hsncode: 'hsn_codes', hsn: 'hsn_codes', hsncodes: 'hsn_codes',
        gst: 'taxes', taxes: 'taxes', tax: 'taxes'
    };
    
    const table = tableMap[entity];
    if (!table) {
        return next();
    }
    
    console.log("DELETE REQUEST BODY:", req.body);
    let ids = req.body;
    if (typeof req.body === 'object' && req.body !== null) {
        if (Array.isArray(req.body.ids)) {
            ids = req.body.ids;
        } else if (Array.isArray(req.body)) {
            ids = req.body;
        }
    }
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required for bulk delete' });
    }
    
    try {
        const result = await pool.query(`
            DELETE FROM ${table} WHERE id = ANY($1) RETURNING id
        `, [ids]);
        
        return res.json({ success: true, count: result.rows.length, message: `Successfully deleted ${result.rows.length} records from ${table}` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
