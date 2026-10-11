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
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(150) NOT NULL,
  order_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(150) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  line_total NUMERIC(10,2) NOT NULL CHECK (line_total >= 0)
);

INSERT INTO inventory (name, sku, description, quantity, price, low_stock_threshold)
VALUES
  ('Wireless Mouse', 'WM-001', 'Ergonomic wireless mouse', 12, 24.99, 5),
  ('Mechanical Keyboard', 'MK-002', 'RGB mechanical keyboard', 8, 59.99, 4),
  ('USB-C Hub', 'USB-003', 'Multiport USB-C hub', 5, 34.50, 3)
ON CONFLICT (sku) DO NOTHING;
