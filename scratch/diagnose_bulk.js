const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const fileNames = ['Customer List.xlsx', 'Customer Temp.xlsx', 'Customer Temp.csv'];
const downloadsDir = 'c:/Users/user/Downloads';

async function diagnose() {
    let filePath = '';
    let workbook;
    for (const name of fileNames) {
        try {
            filePath = path.join(downloadsDir, name);
            workbook = XLSX.readFile(filePath);
            console.log(`Successfully loaded ${name}`);
            break;
        } catch (e) {
            // try next
        }
    }

    if (!workbook) {
        console.error("Could not find any Excel files to diagnose.");
        await pool.end();
        return;
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Parse 2D array
    const headers = rawData[0].map(h => String(h).trim());
    console.log("Parsed Excel Headers:", headers);
    console.log("First Row object parsed:", rows[0]);
    await pool.end();
    return;

    console.log(`Total rows parsed: ${rows.length}`);
    console.log("Diagnosing rows on database...");

    const client = await pool.connect();
    try {
        // Run WITHOUT BEGIN/COMMIT so queries execute independently and don't abort the transaction block,
        // but we will delete any inserted data at the end or run inside a rolled back transaction with SAVEPOINTS.
        // Actually, we can just run queries one by one and not commit them, but to get all errors, we can query relations.
        
        const routesRes = await client.query('SELECT id, route_name FROM routes');
        const empRes = await client.query('SELECT id, employee_name FROM employees');
        const chanRes = await client.query('SELECT id, channel_name FROM channels');
        
        const routeMap = {};
        routesRes.rows.forEach(r => routeMap[r.route_name.toLowerCase().trim()] = r.id);
        const empMap = {};
        empRes.rows.forEach(e => empMap[e.employee_name.toLowerCase().trim()] = e.id);
        const chanMap = {};
        chanRes.rows.forEach(c => chanMap[c.channel_name.toLowerCase().trim()] = c.id);

        let failedRows = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // 1-based, sheet row

            const customer_name = row.customer_name || row["Customer Name"];
            const route_name = row.route_name || row["Route Name"];
            const employee_name = row.employee_name || row["Employee Name"] || row.dse_name;
            const channel_name = row.channel_name || row["Channel Name"];

            if (!customer_name) {
                failedRows.push({ row: rowNum, error: "Customer Name is missing" });
                continue;
            }

            if (route_name && !routeMap[String(route_name).toLowerCase().trim()]) {
                failedRows.push({ row: rowNum, customer: customer_name, error: `Route '${route_name}' does not exist in database` });
            }
            if (employee_name && !empMap[String(employee_name).toLowerCase().trim()]) {
                failedRows.push({ row: rowNum, customer: customer_name, error: `Employee '${employee_name}' does not exist in database` });
            }
            if (channel_name && !chanMap[String(channel_name).toLowerCase().trim()]) {
                failedRows.push({ row: rowNum, customer: customer_name, error: `Channel '${channel_name}' does not exist in database` });
            }
        }

        console.log(`Diagnostic finished. Found ${failedRows.length} errors:`);
        console.table(failedRows.slice(0, 50));
        if (failedRows.length > 50) {
            console.log(`... and ${failedRows.length - 50} more errors.`);
        }

    } catch (err) {
        console.error("Diagnostic failed with error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

diagnose();
