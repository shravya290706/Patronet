# PATRONET

A full-stack online shopping platform built with React, FastAPI and Aiven cloud services.

## Technology Stack

**Frontend**
- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui

**Backend**
- Python 3.13+
- FastAPI
- Uvicorn
- SQLAlchemy
- Alembic
- Pydantic
- Ruff

**Cloud Infrastructure**
- Aiven PostgreSQL – relational database
- Aiven Apache Kafka – event streaming
- Aiven OpenSearch – product search

## Project Structure

```text
Patronet/
├── patronet-frontend/
│   ├── src/
│   ├── components.json
│   ├── package.json
│   └── package-lock.json
│
├── patronet-backend/
│   ├── app/
│   ├── certs/
│   │   └── ca.pem
│   ├── tests/
│   │   ├── test_kafka.py
│   │   ├── test_opensearch.py
│   │   └── test_postgres.py
│   └── requirements.txt
│
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

## Prerequisites

Install:
- Git
- Node.js and npm
- Python 3.13+

## Getting Started

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Patronet
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the project root.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in the required connection details using your authorised Aiven project access.

Never commit `.env` or share service passwords publicly.

### 3. Backend setup

```powershell
cd patronet-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Return to the backend directory whenever opening a new terminal and activate the virtual environment.

Start the backend:

```powershell
python -m uvicorn app.main:app --reload
```

Backend: http://127.0.0.1:8000

API documentation: http://127.0.0.1:8000/docs

Health check: http://127.0.0.1:8000/health

### 4. Frontend setup

Open another terminal from the repository root:

```powershell
cd patronet-frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## Customer Authentication

Set `JWT_SECRET_KEY` in the repository-root `.env` to a randomly generated secret of at least 32 bytes. Generate one locally with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

`JWT_ACCESS_TOKEN_EXPIRE_MINUTES` defaults to 30. The auth endpoints are `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`. Login returns a Bearer access token for use in the `Authorization` header.

Run the auth tests from `patronet-backend` with the virtual environment activated:

```powershell
python -m pytest tests/test_auth.py -q
```

## Customer Addresses

All address endpoints require a login Bearer token. `POST /api/addresses` accepts `full_name`, `phone`, `address_line_1`, optional `address_line_2`, `city`, `state`, `pincode`, `country`, optional `label`, and optional `is_default`. It returns `201` with the saved address and its ID. `GET /api/addresses` lists only the authenticated customer's addresses, default first; `GET /api/addresses/{address_id}` returns one owned address.

`PATCH /api/addresses/{address_id}` accepts any subset of address fields, including `is_default`. `PATCH /api/addresses/{address_id}/default` sets the selected owned address as default. `DELETE /api/addresses/{address_id}` returns `204`; deleting the default promotes the oldest remaining address. Addresses referenced by existing orders cannot be deleted.

The address migration adds line 2, country, label, and `created_at` columns. It has not been applied. Existing rows get a migration-time `created_at`; their relative age is unknown and uses ID as a tie-breaker. Legacy country values remain `NULL` until updated.

## Shopping Cart

All cart endpoints require the login Bearer token. `GET /api/cart` returns the active cart, or an empty cart when one does not exist. Add an item with `POST /api/cart/items` using `{"product_id": "<UUID>", "quantity": 2}`; update its quantity with `PATCH /api/cart/items/{item_id}` using `{"quantity": 3}`. `DELETE /api/cart/items/{item_id}` removes one item, and `DELETE /api/cart` clears all items. Successful deletes return `204 No Content`.

Cart prices and subtotals are calculated from current database product prices. Stock is checked against inventory in active stores, but is not reserved or deducted; checkout must validate stock again.

Run isolated cart tests from `patronet-backend` with the virtual environment activated:

```powershell
python -m pytest tests/test_cart_api.py -q
```

## Checkout and Orders

All order endpoints require the login Bearer token. Checkout requires a shipping address already belonging to the authenticated customer:

```json
{ "address_id": "<customer-address-UUID>" }
```

`POST /api/orders/checkout` returns `201` with the order number, simulated payment/status fields, delivery-address snapshot, item lines (`product_id`, `store_id`, `quantity`, `unit_price`, and `subtotal`), and calculated `subtotal`/`total_amount`. The current schema has no product-name or SKU snapshot columns in `order_items`; those values are included in the transactional `order.placed` outbox payload instead. No card or banking details are accepted.

`GET /api/orders?page=1&page_size=20` returns the authenticated customer's newest orders with pagination. `GET /api/orders/{order_id}` returns one of that customer's orders; other customers receive `404`. Checkout, inventory deductions, cart clearing, and the pending outbox event commit together. Inventory rows are locked during stock validation and allocation; SQLite tests cannot simulate PostgreSQL's row-level concurrency behavior.

Run isolated checkout and order tests from `patronet-backend` with the virtual environment activated:

```powershell
python -m pytest tests/test_orders_api.py -q
```

## Running Backend Tests

From `patronet-backend`, with the virtual environment activated:

```powershell
python -m pytest
```

PostgreSQL, Kafka, and OpenSearch checks are marked as integration tests and are skipped unless explicitly enabled. Normal pytest collection does not open service connections or perform writes.

### Opt-in Aiven integration smoke tests

These checks use the configured Aiven services. The PostgreSQL connectivity check is read-only; the PostgreSQL smoke check creates `integration_test` if needed and inserts a row. The Kafka check produces and consumes a test message, and the OpenSearch check creates/updates a test document. Run them only when intentionally testing against the configured services:

```powershell
$env:PATRONET_RUN_AIVEN_INTEGRATION_TESTS = "1"
python -m pytest -m integration
Remove-Item Env:PATRONET_RUN_AIVEN_INTEGRATION_TESTS
```

## Product Search Index

The product search endpoint is `GET /api/products/search`. It accepts `q`, `category_id`, `brand`, `min_price`, `max_price`, `city`, `page`, `page_size`, and `sort` (`relevance`, `price_asc`, `price_desc`, or `newest`).

Rebuild the OpenSearch index from PostgreSQL while in `patronet-backend` with the virtual environment activated:

```powershell
python -m scripts.rebuild_product_search_index
```

The rebuild creates a new versioned index, bulk-indexes PostgreSQL products and their category/image/store inventory data, then atomically switches the `patronet_products` alias. Previous indices are retained; this command does not delete them.

## Kafka Order Events

The order event pipeline is PostgreSQL transactional outbox → Kafka → OpenSearch. Checkout stores `order.placed` in the same PostgreSQL transaction as the order and inventory changes. The independent publisher sends the outbox event ID as the Kafka key and marks the row published only after broker delivery confirmation. Delivery is at-least-once: a crash after Kafka confirms but before PostgreSQL records the confirmation may result in a duplicate, which the consumer handles by synchronizing current PostgreSQL inventory state rather than deducting stock again.

Configure these variables in the repository-root `.env`:

- `KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_USERNAME`, `KAFKA_PASSWORD`
- `KAFKA_SECURITY_PROTOCOL` (defaults to `SASL_SSL`) and `KAFKA_SASL_MECHANISM` (defaults to `PLAIN`)
- `KAFKA_CA_LOCATION` (optional override; defaults to `patronet-backend/certs/ca.pem`)
- `KAFKA_ORDER_EVENTS_TOPIC` (the topic must already exist)
- `KAFKA_ORDER_EVENTS_CONSUMER_GROUP` (a dedicated consumer group name)

The publisher and consumer also require their configured PostgreSQL and OpenSearch connection variables. Ensure the `patronet_products` alias already exists by rebuilding the product index before processing order events. No worker starts automatically with FastAPI.

From `patronet-backend`, with the virtual environment activated, use separate terminals for the long-running publisher and consumer:

```powershell
python -m scripts.publish_outbox
python -m scripts.consume_order_events
```

Check broker connectivity and configured topic metadata without producing a message or creating a topic:

```powershell
python -m scripts.check_kafka
```

The message value is JSON with `event_id`, `event_type`, `aggregate_type`, `aggregate_id`, `created_at`, and `payload`. For `order.placed`, the payload includes order/customer IDs, order/payment status and totals, delivery snapshot, and item details. The consumer disables automatic offset commits and commits only after OpenSearch synchronization succeeds. Transient processing failures are retried; exhausted retries or malformed events stop the worker without committing that offset so it is not silently skipped. Resolve the event/problem before restarting the consumer.

Kafka worker tests use mocks and isolated SQLite data; they do not contact Aiven. No migration is required. A real Aiven Kafka/TLS and OpenSearch end-to-end check remains a separate, intentional operational verification.

## Code Quality

Backend:

```powershell
ruff check .
python -m pip check
```

Frontend:

```powershell
npm run lint
npm run build
```

## Team Development

- Use separate Git branches for individual features.
- Pull the latest changes before starting work.
- Commit and push completed changes.
- Keep credentials and environment files private.
- Do not commit virtual environments or generated build files.

## Project Status

The frontend and backend foundations are established. All three Aiven services have passed basic connectivity and data-operation integration tests. Full shopping workflows are under development.
