# API reference

## Inventory API

Base path: `/api/inventory`

### GET `/api/inventory`
Returns the full inventory list.

### GET `/api/inventory/:id`
Returns a single item by ID.

### POST `/api/inventory`
Creates a new inventory item.

Request example:

```json
{
  "name": "Wireless Mouse",
  "sku": "WM-001",
  "description": "Ergonomic wireless mouse",
  "quantity": 12,
  "price": 24.99,
  "low_stock_threshold": 5
}
```

Response example:

```json
{
  "message": "Inventory item added successfully.",
  "item": {
    "id": 4,
    "name": "Wireless Mouse",
    "sku": "WM-001",
    "description": "Ergonomic wireless mouse",
    "quantity": 12,
    "price": "24.99",
    "low_stock_threshold": 5
  }
}
```

### PUT `/api/inventory/:id`
Updates an existing item.

### DELETE `/api/inventory/:id`
Deletes an item only when the quantity is zero.

## Orders API

Base path: `/api/orders`

### GET `/api/orders`
Returns all orders with embedded items.

### POST `/api/orders`
Creates a new order and reduces inventory stock.

Request example:

```json
{
  "customerName": "Alice", 
  "items": [
    { "sku": "WM-001", "quantity": 2 }
  ]
}
```

Response example:

```json
{
  "message": "Order created successfully.",
  "order": {
    "id": 1,
    "customer_name": "Alice",
    "order_status": "pending",
    "total_price": "49.98",
    "items": [
      {
        "sku": "WM-001",
        "itemName": "Wireless Mouse",
        "quantity": 2,
        "price": 24.99,
        "lineTotal": 49.98
      }
    ]
  }
}
```

## Health endpoints

- `GET /health`
- `GET /api/inventory/health`
- `GET /api/orders/health`
