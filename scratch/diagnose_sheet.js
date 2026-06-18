const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const downloadsDir = 'c:/Users/user/Downloads';

async function diagnose() {
    let filePath = path.join(downloadsDir, 'Customer List.xlsx');
    let workbook;
    try {
        workbook = XLSX.readFile(filePath);
    } catch (e) {
        console.error("Could not load Customer List.xlsx:", e.message);
        await pool.end();
        return;
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const headers = rawData[0].map(h => String(h).trim());
    const rows = [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        if (row.every(val => val === null || val === undefined || String(val).trim() === '')) {
            continue;
        }
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : null;
        });
        rows.push(obj);
    }

    console.log(`Total rows in Excel: ${rows.length}`);

    const client = await pool.connect();
    try {
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
            const rowNum = i + 2;

            const customer_name = row.customer_name || row["Customer Name"] || row["Customer"];
            const route_name = row.route_name || row["Route Name"] || row["Area"] || row["Route"];
            const employee_name = row.employee_name || row["Employee Name"] || row.dse_name || row["Employee"];
            const channel_name = row.channel_name || row["Channel Name"] || row["Channel"];

            if (!customer_name) {
                failedRows.push({ row: rowNum, error: "Customer Name is missing" });
                continue;
            }

            if (route_name && !routeMap[String(route_name).toLowerCase().trim()]) {
                failedRows.push({ row: rowNum, customer: customer_name, field: 'Route', value: route_name, error: `Route '${route_name}' does not exist in routes table` });
            }
            if (employee_name && !empMap[String(employee_name).toLowerCase().trim()]) {
                failedRows.push({ row: rowNum, customer: customer_name, field: 'Employee', value: employee_name, error: `Employee '${employee_name}' does not exist in employees table` });
            }
            if (channel_name && !chanMap[String(channel_name).toLowerCase().trim()]) {
                failedRows.push({ row: rowNum, customer: customer_name, field: 'Channel', value: channel_name, error: `Channel '${channel_name}' does not exist in channels table` });
            }
        }

        console.log(`Diagnostic finished. Found ${failedRows.length} rows with mismatch errors out of ${rows.length}:`);
        console.table(failedRows.slice(0, 30));
        if (failedRows.length > 30) {
            console.log(`... and ${failedRows.length - 30} more mismatch errors.`);
        }
    } catch (err) {
        console.error("Diagnostic failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

diagnose();
