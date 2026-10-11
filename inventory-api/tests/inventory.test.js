const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { newDb } = require('pg-mem');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3001);

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

function parseNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return parsed;
}

function validateItemPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Request body is required.');
  }

  const requiredFields = ['name', 'sku', 'quantity', 'price'];
  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === '') {
      throw new Error(`Field '${field}' is required.`);
    }
  }

  const name = String(payload.name).trim();
  const sku = String(payload.sku).trim();
  const description = payload.description ? String(payload.description).trim() : '';
  const quantity = parseNumber(payload.quantity, 'quantity');
  const price = parseNumber(payload.price, 'price');
  const threshold = payload.low_stock_threshold === undefined ? 5 : parseNumber(payload.low_stock_threshold, 'low_stock_threshold');

  if (name.length < 2) {
    throw new Error('Item name must be at least 2 characters long.');
  }

  if (sku.length < 2) {
    throw new Error('SKU is required and must be at least 2 characters long.');
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('Quantity must be a non-negative integer.');
  }

  if (price < 0) {
    throw new Error('Price cannot be negative.');
  }

  if (!Number.isInteger(threshold) || threshold < 0) {
    throw new Error('Low stock threshold must be a non-negative integer.');
  }

  return {
    name,
    sku,
    description,
    quantity,
    price,
    low_stock_threshold: threshold
  };
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'inventory-api' });
});

app.get('/api/inventory/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'inventory-api' });
});

app.get('/api/inventory', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, sku, description, quantity, price, low_stock_threshold,
             CASE WHEN quantity <= low_stock_threshold THEN true ELSE false END AS is_low_stock,
             created_at, updated_at
      FROM inventory
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Inventory retrieval failed:', error);
    res.status(500).json({ error: 'Inventory retrieval failed.', details: error.message });
  }
});

app.get('/api/inventory/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Inventory item lookup failed:', error);
    return res.status(500).json({ error: 'Inventory lookup failed.', details: error.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const payload = validateItemPayload(req.body);
    const result = await pool.query(
      `INSERT INTO inventory (name, sku, description, quantity, price, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [payload.name, payload.sku, payload.description, payload.quantity, payload.price, payload.low_stock_threshold]
    );

    res.status(201).json({ message: 'Inventory item added successfully.', item: result.rows[0] });
  } catch (error) {
    console.error('Inventory create failed:', error);

    if (error.code === '23505') {
      return res.status(409).json({ error: 'A product with the same SKU already exists.' });
    }

    if (error.message.includes('must be') || error.message.includes('required')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Inventory item could not be created.', details: error.message });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const payload = validateItemPayload({
      ...existing.rows[0],
      ...req.body,
      quantity: req.body.quantity ?? existing.rows[0].quantity,
      price: req.body.price ?? existing.rows[0].price,
      low_stock_threshold: req.body.low_stock_threshold ?? existing.rows[0].low_stock_threshold
    });

    const result = await pool.query(
      `UPDATE inventory SET name = $1, sku = $2, description = $3, quantity = $4, price = $5, low_stock_threshold = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [payload.name, payload.sku, payload.description, payload.quantity, payload.price, payload.low_stock_threshold, req.params.id]
    );

    return res.json({ message: 'Inventory item updated successfully.', item: result.rows[0] });
  } catch (error) {
    console.error('Inventory update failed:', error);

    if (error.code === '23505') {
      return res.status(409).json({ error: 'A product with the same SKU already exists.' });
    }

    if (error.message.includes('must be') || error.message.includes('required')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Inventory update failed.', details: error.message });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const current = await pool.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    if (Number(current.rows[0].quantity) > 0) {
      return res.status(400).json({ error: 'Cannot delete an item that still has stock remaining.' });
    }

    await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Inventory item deleted successfully.' });
  } catch (error) {
    console.error('Inventory delete failed:', error);
    return res.status(500).json({ error: 'Inventory deletion failed.', details: error.message });
  }
});

async function startServer() {
  await initSchema();
  app.listen(port, () => {
    console.log(`Inventory API running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, pool, initSchema };
