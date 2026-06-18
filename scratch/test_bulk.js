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
        "Customer Code", "Customer", "Phone Number", "Address", "Area", "Pin Code", "GST"
      ],
      [
        "CUST0001", "A One Traders Test", "9876543210", "123 Main St", "Friday", "673001", "32ABCDE1234F1Z1"
      ]
    ],
    "name": "Customers"
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
            } catch (err) {
                console.error(`Row ${rowNumber} failed:`, err);
                errors.push({ row: rowNumber, error: err.message });
            }
        }

        await client.query('COMMIT');
        console.log("Success! Summary:", { totalRows: rawBody.length, inserted: insertedCount, updated: updatedCount, failed: errors.length }, "Errors:", errors);
    } catch (err) {
        console.error("Outer transaction block failed:", err);
        await client.query('ROLLBACK');
    } finally {
        client.release();
        await pool.end();
    }
}

run();
