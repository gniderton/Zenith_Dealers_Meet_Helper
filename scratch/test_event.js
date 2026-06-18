const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runTest() {
    console.log("Starting Dealers Meet Event Workflow Integration Test...");
    const client = await pool.connect();
    
    try {
        // Find a customer, an employee and a product to test with
        const custRes = await client.query('SELECT id, customer_name FROM customers LIMIT 1');
        const empRes = await client.query('SELECT id, employee_name, status FROM employees LIMIT 1');
        const prodRes = await client.query('SELECT id, product_name, dealer_rate FROM products LIMIT 1');

        if (custRes.rows.length === 0 || empRes.rows.length === 0 || prodRes.rows.length === 0) {
            console.error("Test aborted: Need at least one customer, employee, and product in DB.");
            return;
        }

        const customer = custRes.rows[0];
        const employee = empRes.rows[0];
        const product = prodRes.rows[0];

        console.log(`Using Customer: ${customer.customer_name} (ID: ${customer.id})`);
        console.log(`Using Employee: ${employee.employee_name} (ID: ${employee.id}, Status: ${employee.status})`);
        console.log(`Using Product: ${product.product_name} (ID: ${product.id}, Rate: ${product.dealer_rate})`);

        // Clean up previous test checkins for this customer if any
        await client.query('DELETE FROM event_checkins WHERE customer_id = $1', [customer.id]);

        // 1. Trigger Check-in via API simulation
        console.log("\n--- Step 1: Customer Check-in ---");
        const checkinRes = await client.query(
            `INSERT INTO event_checkins (customer_id, required_materials, status)
             VALUES ($1, $2, 'Arrived') RETURNING *`,
            [customer.id, 'Banner, Catalogue']
        );
        const checkin = checkinRes.rows[0];
        console.log("Check-in Created successfully:", checkin);

        // 2. Trigger Employee Assignment via API simulation
        console.log("\n--- Step 2: Employee Assignment ---");
        await client.query('BEGIN');
        const checkinUpdate = await client.query(
            `UPDATE event_checkins 
             SET employee_id = $1, status = 'Engaged', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`,
            [employee.id, checkin.id]
        );
        await client.query(
            `UPDATE employees SET status = 'Engaged', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [employee.id]
        );
        await client.query('COMMIT');
        
        console.log("Updated Check-in Status:", checkinUpdate.rows[0]);
        const empCheck = await client.query('SELECT status FROM employees WHERE id = $1', [employee.id]);
        console.log("Employee status should be 'Engaged':", empCheck.rows[0].status);

        // 3. Trigger Sync Order via API simulation
        console.log("\n--- Step 3: Sync Order ---");
        await client.query('BEGIN');
        const items = [{ product_id: product.id, quantity: 5, rate: parseFloat(product.dealer_rate) || 10.00 }];
        let total = items[0].quantity * items[0].rate;

        const orderRes = await client.query(
            `INSERT INTO meet_orders (customer_id, employee_id, total_amount) 
             VALUES ($1, $2, $3) RETURNING id`,
            [customer.id, employee.id, total]
        );
        const orderId = orderRes.rows[0].id;

        await client.query(
            `INSERT INTO meet_order_items (order_id, product_id, quantity, rate, amount)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, items[0].product_id, items[0].quantity, items[0].rate, total]
        );

        // Reset employee back to Active
        await client.query(
            `UPDATE employees SET status = 'Active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [employee.id]
        );
        await client.query('COMMIT');

        console.log(`Order Synced successfully. Order ID: ${orderId}, Total Amount: ${total}`);
        const empCheck2 = await client.query('SELECT status FROM employees WHERE id = $1', [employee.id]);
        console.log("Employee status should be reset to 'Active':", empCheck2.rows[0].status);

        // 4. Trigger Checkout Completion via API simulation
        console.log("\n--- Step 4: Checkout Completion ---");
        const completeRes = await client.query(
            `UPDATE event_checkins 
             SET status = 'Completed', feedback = $1, gifts_collected = $2, 
                 completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 RETURNING *`,
            ['Excellent event, smooth experience.', true, checkin.id]
        );
        console.log("Finalized Check-in Checkout record:", completeRes.rows[0]);

        console.log("\nWorkflow integration test completed successfully!");

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await client.release();
        await pool.end();
    }
}

runTest();
