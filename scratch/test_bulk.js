const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const payload = [
  {
    "data": [
      [
        "ID (Only for updates)", "Customer Name", "Customer Phone", "Email", "GSTIN", "PAN", 
        "Route Name", "Employee Name", "Channel Name", "WhatsApp Number", "Credit Limit", 
        "Credit Days", "Default Price Tier", "Latitude", "Longitude", "Is Active"
      ],
      [
        null, "A One Traders", null, null, "", null, "Friday", "Saifudheeen MC", "Dealer", null, null, 30, "Dealer", null, null, "Yes"
      ]
    ],
    "name": "Customers Template"
  }
];

function parseRaw2DArray(body) {
    if (Array.isArray(body) && body.length === 1 && body[0].data && Array.isArray(body[0].data)) {
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

async function run() {
    const rawBody = parseRaw2DArray(payload);
    console.log("Parsed body:", rawBody);
    
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
                const id = row.id || row.ID || row["ID (Only for updates)"];
                const customer_name = row.customer_name || row["Customer Name"];
                const customer_phone = row.customer_phone || row["Customer Phone"];
                const email = row.email || row.Email;
                const gstin = row.gstin || row.GSTIN;
                const pan = row.pan || row.PAN;
                const route_name = row.route_name || row["Route Name"];
                const employee_name = row.employee_name || row["Employee Name"] || row.dse_name;
                const channel_name = row.channel_name || row["Channel Name"];
                const whatsapp_number = row.whatsapp_number || row["WhatsApp Number"];
                
                const parseNum = (val, defaultVal) => {
                    if (val === null || val === undefined || val === '') return defaultVal;
                    const parsed = parseFloat(val);
                    return isNaN(parsed) ? defaultVal : parsed;
                };

                const credit_limit = parseNum(row.credit_limit || row["Credit Limit"], 0);
                const credit_days = parseInt(parseNum(row.credit_days || row["Credit Days"], 0));
                const default_price_tier = row.default_price_tier || row["Default Price Tier"] || 'Dealer';
                const latitude = parseNum(row.latitude || row["Latitude"], null);
                const longitude = parseNum(row.longitude || row["Longitude"], null);
                
                const rawActive = row.is_active || row["Is Active"];
                const is_active = rawActive !== undefined ? (rawActive === 'Yes' || rawActive === true || rawActive === 'true' || rawActive === 1 || rawActive === '1' || String(rawActive).toLowerCase() === 'active') : true;

                if (!customer_name) throw new Error('Customer Name is missing');

                let route_id = null;
                if (route_name) {
                    const check = await client.query('SELECT id FROM routes WHERE route_name = $1 LIMIT 1', [route_name]);
                    if (check.rows.length > 0) route_id = check.rows[0].id;
                }
                let dse_id = null;
                if (employee_name) {
                    const check = await client.query('SELECT id FROM employees WHERE employee_name = $1 LIMIT 1', [employee_name]);
                    if (check.rows.length > 0) dse_id = check.rows[0].id;
                }
                let channel_id = null;
                if (channel_name) {
                    const check = await client.query('SELECT id FROM channels WHERE channel_name = $1 LIMIT 1', [channel_name]);
                    if (check.rows.length > 0) channel_id = check.rows[0].id;
                }

                let matchFound = false;
                if (id && /^\d+$/.test(id)) {
                    const check = await client.query('SELECT id FROM customers WHERE id = $1', [id]);
                    if (check.rows.length > 0) {
                        await client.query(
                            `UPDATE customers SET 
                                customer_name = $1, customer_phone = $2, email = $3, gstin = $4, pan = $5,
                                route_id = $6, employee_id = $7, channel_id = $8, whatsapp_number = $9,
                                credit_limit = $10, credit_days = $11, default_price_tier = $12,
                                latitude = $13, longitude = $14, is_active = $15, updated_at = CURRENT_TIMESTAMP
                             WHERE id = $16`,
                            [customer_name, customer_phone || null, email || null, gstin || null, pan || null, route_id, dse_id, channel_id, whatsapp_number || null, credit_limit, credit_days, default_price_tier, latitude || null, longitude || null, is_active, id]
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
                                credit_limit = $9, credit_days = $10, default_price_tier = $11,
                                latitude = $12, longitude = $13, is_active = $14, updated_at = CURRENT_TIMESTAMP
                             WHERE customer_name = $15`,
                            [customer_phone || null, email || null, gstin || null, pan || null, route_id, dse_id, channel_id, whatsapp_number || null, credit_limit, credit_days, default_price_tier, latitude || null, longitude || null, is_active, customer_name]
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
                            credit_limit, credit_days, default_price_tier,
                            latitude, longitude, is_active
                         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                        [customer_name, customer_phone || null, email || null, gstin || null, pan || null, route_id, dse_id, channel_id, whatsapp_number || null, credit_limit, credit_days, default_price_tier, latitude || null, longitude || null, is_active]
                    );
                    insertedCount++;
                }
            } catch (err) {
                console.error(`Row ${rowNumber} failed:`, err);
                errors.push({ row: rowNumber, error: err.message });
            }
        }

        await client.query('COMMIT');
        console.log("Success! Summary:", { totalRows: rawBody.length, inserted: insertedCount, updated: updatedCount, failed: errors.length });
    } catch (err) {
        console.error("Outer transaction block failed:", err);
        await client.query('ROLLBACK');
    } finally {
        client.release();
        await pool.end();
    }
}

run();
