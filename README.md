# Kirana Backend — Lending & Ledger API

A high-performance, multi-tenant financial ledger and lending calculation backend built for Kirana (local grocery & merchant) credit management. Features precise per-entry interest calculation (Simple, Compound with customizable compounding intervals, Leap-Year support), chronological FIFO payment allocation, targeted entry settlement, overpayment credit buffering, and production-hardened security.

---

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Prerequisites & System Requirements](#prerequisites--system-requirements)
3. [Installation](#installation)
4. [Environment Variables & Configuration](#environment-variables--configuration)
5. [Development Environment](#development-environment)
6. [Test Environment & Database Safety](#test-environment--database-safety)
7. [Production Environment & Hardening](#production-environment--hardening)
8. [Database Setup & Migrations](#database-setup--migrations)
9. [Authentication & Authorization](#authentication--authorization)
10. [CORS Configuration](#cors-configuration)
11. [Rate Limiting](#rate-limiting)
12. [API Base URL & Endpoints](#api-base-url--endpoints)
13. [Frontend Integration Guide](#frontend-integration-guide)
14. [Deployment Checklist](#deployment-checklist)
15. [Project Structure](#project-structure)

---

## Tech Stack
* **Runtime**: Node.js (`v20.19.0+` required by Prisma 7)
* **Language**: TypeScript (`v5+` / `v6+`)
* **Web Framework**: Express.js 5
* **Database**: PostgreSQL (`v14+`)
* **ORM & Migrations**: Prisma 7 (`v7.9.1`) with `@prisma/adapter-pg`
* **Validation**: Zod
* **Authentication**: JSON Web Token (`jsonwebtoken`) & `bcryptjs`
* **Security Middleware**: Express Rate Limit, Helmet, CORS, Compression
* **Logging**: Winston & Morgan
* **Testing**: Jest & Supertest

---

## Prerequisites & System Requirements
Ensure the following are installed on your machine or deployment environment:
* **Node.js**: **`>=20.19.0`** (Strict requirement enforced by Prisma 7.9.1)
* **npm**: `v9.0.0` or higher
* **PostgreSQL**: `v14` or higher running locally or accessible over SSL

---

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dj933429-wq/kirana-backend.git
   cd kirana-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

---

## Environment Variables & Configuration

The application validates all configuration at boot via Zod (`src/config/index.ts`).

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | Integer | `3000` | Port for the HTTP server |
| `NODE_ENV` | Enum | `development` | Environment mode (`development`, `production`, `test`) |
| `DATABASE_URL` | String (URL) | — | PostgreSQL connection URL |
| `DATABASE_POOL_SIZE` | Integer (1-100) | `10` | Maximum PostgreSQL client pool size |
| `DATABASE_SSL` | Boolean | `false` | Enable TLS/SSL connection for PostgreSQL |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Boolean | `true` | Enforce TLS certificate validation (set `false` only for self-signed CAs) |
| `JWT_SECRET` | String | — | Secret for JWT signing (min 8 chars in dev, min 32 in prod) |
| `JWT_EXPIRES_IN` | String | `1d` | Token lifetime (e.g. `1d`, `7d`, `12h`) |
| `CORS_ALLOWED_ORIGINS` | String | `*` | Allowed browser origins (`*` in dev, comma-separated URLs in prod) |
| `RATE_LIMIT_WINDOW_MS` | Integer | `900000` | Brute-force rate limit window in milliseconds (15 mins) |
| `RATE_LIMIT_MAX_LOGIN_ATTEMPTS` | Integer | `10` | Max login attempts per IP within the window |

---

## Development Environment

### 1. Configure `.env`
```env
PORT=3000
NODE_ENV="development"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kirana_ledger?schema=public"
DATABASE_POOL_SIZE=10
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=true
JWT_SECRET="your-super-secret-jwt-key-min-8-chars"
JWT_EXPIRES_IN="1d"
CORS_ALLOWED_ORIGINS="*"
```

### 2. Setup Local Database & Seed Sample Data
```bash
# Push schema to local PostgreSQL
npx prisma db push

# Generate typed Prisma Client
npx prisma generate

# Seed sample merchant and customers
npx prisma db seed
```

### 3. Start Development Server
```bash
npm run dev
```
Server boots at `http://localhost:3000` with hot-reload.

### 4. Development Credentials
* **Merchant Email**: `merchant@test.com`
* **Merchant Password**: `password123`
* **Business Name**: `Gupta Kirana & Grain Store`

---

## Test Environment & Database Safety

> [!CAUTION]
> Automated tests (`npm test`) execute destructive table cleanup (`deleteMany()`) during test fixtures. Tests must **NEVER** target a production database.

### Built-in Safety Guards:
1. **Production Marker Guard**: The application rejects test execution if `DATABASE_URL` contains production identifiers (`prod_db`, `production`, `live_db`).
2. **Dedicated Test Database**: Configure a `.env.test` file pointing to a separate test database:
   ```env
   # .env.test
   NODE_ENV="test"
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kirana_test?schema=public"
   JWT_SECRET="test-secret-key-12345"
   ```
3. **Run Automated Test Suite**:
   ```bash
   npm test
   ```

---

## Production Environment & Hardening

In production (`NODE_ENV="production"`), the server enforces strict security:

1. **High-Entropy JWT Secret**:
   - Must be at least **32 characters long**.
   - Rejects common placeholder words (`secret`, `password`, `your-super-secret`, etc.).
   - Generate a strong secret via:
     ```bash
     openssl rand -base64 32
     ```
2. **Restricted CORS**:
   - Rejects wildcard `*`.
   - Requires explicit comma-separated HTTPS frontend URLs:
     ```env
     CORS_ALLOWED_ORIGINS="https://app.kiranaledger.com,https://admin.kiranaledger.com"
     ```
3. **PostgreSQL Connection Pooling & SSL**:
   - Configure connection pool capacity based on server capacity:
     ```env
     DATABASE_POOL_SIZE=20
     DATABASE_SSL=true
     DATABASE_SSL_REJECT_UNAUTHORIZED=true
     ```
4. **Brute-Force Rate Limiting**:
   - `POST /api/v1/auth/login` limits failed attempts per IP address, returning `429 Too Many Requests`.

---

## Database Setup & Migrations

### Local / Prototype Workflow:
```bash
npx prisma db push
```

### Production Migration Strategy:
> [!IMPORTANT]
> In production, **NEVER run `npx prisma db seed`**.

* **Applying Migrations**: Production environments should execute:
  ```bash
  npx prisma migrate deploy
  ```
  `prisma migrate deploy` applies all committed SQL migrations in `prisma/migrations` to the target database in order.
* **Zero-Downtime Notice**: `prisma migrate deploy` executes DDL statements against the database. Achieving true zero-downtime during major schema upgrades depends on using backward-compatible schema changes (the expand-and-contract pattern) alongside rolling deployment strategies.
* **Migration Status in Repository**: The repository contains the initial baseline migration (`prisma/migrations/20260804135514_init`). Prior to deploying to a fresh production database, ensure all incremental migrations for the latest schema are committed.

---

## Authentication & Authorization

All customer and transaction routes require a valid JWT Bearer token.

1. **Login**: `POST /api/v1/auth/login`
   ```json
   {
     "email": "merchant@test.com",
     "password": "password123"
   }
   ```
2. **Response**: Returns `{ status: "success", data: { token: "...", user: { ... } } }`.
3. **Protected Requests**: Pass header `Authorization: Bearer <TOKEN>`.

---

## CORS Configuration

* **Development**: Allows `*` for seamless testing across `localhost:5173`, `localhost:3000`, etc.
* **Production**: Validates the `Origin` request header against `CORS_ALLOWED_ORIGINS`. Server-to-server requests and health check probes (without `Origin` header) are permitted.

---

## Rate Limiting

The authentication endpoint (`POST /api/v1/auth/login`) is protected by `loginRateLimiter`:
* Configured by `RATE_LIMIT_WINDOW_MS` (default 15 mins) and `RATE_LIMIT_MAX_LOGIN_ATTEMPTS` (default 10).
* Exceeding the threshold returns `429 Too Many Requests`:
  ```json
  {
    "status": "error",
    "message": "Too many login attempts. Please try again later."
  }
  ```

---

## API Base URL & Endpoints

* **Base URL**: `http://localhost:3000/api/v1` (or your production HTTPS domain)
* **Health Check**: `GET /health`

### Auth
* `POST /api/v1/auth/login` — Authenticate merchant and obtain JWT.

### Customers
* `POST /api/v1/customers` — Create customer.
* `GET /api/v1/customers` — List/search customers (`?page=1&limit=20&sort=name&order=asc&search=...`).
* `GET /api/v1/customers/:id` — Get customer details.
* `PATCH /api/v1/customers/:id` — Update customer.
* `DELETE /api/v1/customers/:id` — Archive customer (soft delete).
* `GET /api/v1/customers/:id/ledger` — Real-time financial ledger calculation (`?calculationDate=YYYY-MM-DD`).
* `GET /api/v1/customers/:id/transactions` — Transaction history.

### Transactions
* `POST /api/v1/transactions` — Create DEBIT or CREDIT (supports `targetEntryId`).
* `GET /api/v1/transactions/:id` — Get single transaction.
* `PATCH /api/v1/transactions/:id/void` — Void transaction.

---

## Frontend Integration Guide

1. **Frontend API URL**:
   - Development: `http://localhost:3000/api/v1`
   - Production: `https://api.kiranaledger.com/api/v1`
2. **Request Headers**:
   ```http
   Content-Type: application/json
   Authorization: Bearer <TOKEN>
   ```
3. **Response Structure**:
   - Success (`2xx`): `{ "status": "success", "data": { ... } }`
   - Error (`4xx`/`5xx`): `{ "status": "error", "message": "...", "errors": [ ... ] }`

---

## Deployment Checklist

Before deploying the backend to a live production environment:

- [ ] Ensure Node.js runtime is **`>=20.19.0`**.
- [ ] Set `NODE_ENV="production"` in environment variables.
- [ ] Generate a 32+ character high-entropy `JWT_SECRET` (`openssl rand -base64 32`).
- [ ] Configure `CORS_ALLOWED_ORIGINS` with the exact HTTPS domain(s) of the frontend.
- [ ] Configure PostgreSQL `DATABASE_URL` with SSL (`DATABASE_SSL=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`).
- [ ] Set `DATABASE_POOL_SIZE` appropriately for your server capacity (e.g. `20`).
- [ ] Run `npx prisma migrate deploy` during deployment pipeline.
- [ ] **DO NOT run `npx prisma db seed` on production**.
- [ ] Build and start with `npm run build && npm run start`.

---

## Project Structure

```text
kirana-backend/
├── prisma/
│   ├── schema.prisma           # Prisma database schema & relations
│   ├── seed.ts                 # Development seed script (resets tables)
│   └── migrations/             # Database migration history
├── src/
│   ├── config/                 # Environment validation, database pool, & SSL
│   ├── controllers/            # Express route controllers
│   ├── middleware/             # Auth, validation, rate limiting, error handling
│   ├── routes/                 # Express route definitions (/api/v1/...)
│   ├── services/               # Financial ledger timeline & interest calculations
│   ├── utils/                  # Interest math calculator & Winston logger
│   ├── app.ts                  # Express application setup & CORS configuration
│   └── server.ts               # Server bootstrap & graceful shutdown handlers
├── .env.example                # Example environment variables with documentation
├── package.json                # Dependencies, scripts, and Node.js engines
└── tsconfig.json               # TypeScript configuration
```
