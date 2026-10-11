const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { newDb } = require('pg-mem');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3002);

app.use(cors());
app.use(express.json());

function getPool() {
  if (process.env.USE_PG_MEM === 'true') {
    const db = newDb();
    const pgAdapter = db.adapters.createPg();
    return new pgAdapter.Pool();
  }

  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'store_inventory'
  });
}

const pool = getPool();

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      sku VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      quantity INTEGER NOT NULL CHECK (quantity >= 0),
      price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(150) NOT NULL,
      order_status VARCHAR(50) NOT NULL DEFAULT 'pending',
      total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      sku VARCHAR(50) NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
      line_total NUMERIC(10,2) NOT NULL CHECK (line_total >= 0)
    )
  `);

  const inventoryCheck = await pool.query('SELECT COUNT(*)::int AS count FROM inventory');
  if (inventoryCheck.rows[0].count === 0) {
    await pool.query(`
      INSERT INTO inventory (name, sku, description, quantity, price, low_stock_threshold)
      VALUES
        ('Wireless Mouse', 'WM-001', 'Ergonomic wireless mouse', 12, 24.99, 5),
        ('Mechanical Keyboard', 'MK-002', 'RGB mechanical keyboard', 8, 59.99, 4),
        ('USB-C Hub', 'USB-003', 'Multiport USB-C hub', 5, 34.50, 3)
    `);
  }
}

function validateOrderPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Request body is required.');
  }

  if (!payload.customerName || String(payload.customerName).trim() === '') {
    throw new Error('Customer name is required.');
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('At least one order item is required.');
  }

  for (const item of payload.items) {
    if (!item || !item.sku || String(item.sku).trim() === '') {
      throw new Error('Each order item must include a valid SKU.');
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Each order quantity must be a positive integer.');
    }
  }
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'orders-api' });
});

app.get('/api/orders/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'orders-api' });
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await pool.query(`
      SELECT o.id, o.customer_name, o.order_status, o.total_price, o.created_at,
             json_agg(json_build_object(
               'id', oi.id,
               'sku', oi.sku,
               'item_name', oi.item_name,
               'quantity', oi.quantity,
               'price', oi.price,
               'line_total', oi.line_total
             )) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, o.customer_name, o.order_status, o.total_price, o.created_at
      ORDER BY o.id DESC
    `);

    const normalized = orders.rows.map((row) => ({
      ...row,
      items: row.items || []
    }));

    res.json(normalized);
  } catch (error) {
    console.error('Order retrieval failed:', error);
    res.status(500).json({ error: 'Order retrieval failed.', details: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    validateOrderPayload(req.body);

    const { customerName, items } = req.body;

    await pool.query('BEGIN');

    const orderRows = [];
    let total = 0;

    for (const item of items) {
      const inventoryResult = await pool.query(
        'SELECT * FROM inventory WHERE sku = $1 FOR UPDATE',
        [item.sku]
      );

      if (inventoryResult.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: `Item with SKU '${item.sku}' does not exist.` });
      }

      const currentItem = inventoryResult.rows[0];
      if (currentItem.quantity < item.quantity) {
        await pool.query('ROLLBACK');
        return res.status(400).json({
          error: `Insufficient stock for '${currentItem.name}'. Available: ${currentItem.quantity}, requested: ${item.quantity}`
        });
      }

      const lineTotal = Number(currentItem.price) * Number(item.quantity);
      total += lineTotal;

      orderRows.push({
        sku: currentItem.sku,
        itemName: currentItem.name,
        quantity: Number(item.quantity),
        price: Number(currentItem.price),
        lineTotal
      });
    }

    const orderResult = await pool.query(
      'INSERT INTO orders (customer_name, total_price, order_status) VALUES ($1, $2, $3) RETURNING *',
      [customerName.trim(), total.toFixed(2), 'pending']
    );

    const orderId = orderResult.rows[0].id;

    for (const row of orderRows) {
      await pool.query(
        `INSERT INTO order_items (order_id, sku, item_name, quantity, price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, row.sku, row.itemName, row.quantity, row.price, row.lineTotal]
      );

      await pool.query(
        `UPDATE inventory SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE sku = $2`,
        [row.quantity, row.sku]
      );
    }

    await pool.query('COMMIT');

    return res.status(201).json({
      message: 'Order created successfully.',
      order: {
        ...orderResult.rows[0],
        total_price: total.toFixed(2),
        items: orderRows
      }
    });
  } catch (error) {
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }

    console.error('Order creation failed:', error);

    if (error.message.includes('required') || error.message.includes('positive')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Order could not be created.', details: error.message });
  }
});

async function startServer() {
  await initSchema();
  app.listen(port, () => {
    console.log(`Orders API running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, pool, initSchema };
