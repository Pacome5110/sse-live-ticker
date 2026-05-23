# SSE Live Ticker

SSE Live Ticker is a real-time market dashboard built for the BMU1208 Web Based Programming final project. It streams simulated stock, BIST, crypto, and forex prices with Server-Sent Events and provides authenticated watchlists and price alerts.

## Features

- Live price stream over native `EventSource`
- REST fallback and detail endpoints for market data
- Email/password auth with bcrypt password hashing
- JWT access tokens plus rotating refresh tokens
- SQLite persistence for users, favorites, alerts, and refresh sessions
- Optional live provider mode for CoinGecko, Frankfurter, and Yahoo quote data
- Watchlist, price alerts, search, sorting, tabs, sparkline rows, themes, and EN/TR UI text
- Basic security headers, CORS controls, input validation, and rate limiting
- Vitest + Supertest API test coverage
- OpenAPI 3.1 specification in `openapi.yaml`

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js, Express |
| Realtime | Server-Sent Events, Node response streams |
| Frontend | Vanilla HTML/CSS/JavaScript, EventSource API |
| Charts | Lightweight Charts |
| Database | SQLite via better-sqlite3 |
| Auth | bcryptjs, jsonwebtoken |
| Test | Vitest, Supertest |

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:3001`.

## Test

```bash
npm test
```

## Environment

Copy `.env.example` to `.env` and change at least `JWT_SECRET` before production use.

## API

The API contract is documented in `openapi.yaml`. Main endpoints:

- `GET /events`
- `GET /api/health`
- `GET /api/stocks`
- `GET /api/stocks/{symbol}`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/favorites`
- `POST /api/favorites/{symbol}`
- `DELETE /api/favorites/{symbol}`
- `GET /api/alerts`
- `POST /api/alerts`
- `DELETE /api/alerts/{id}`

## Data Source Note

The default MVP uses an in-app market universe with random-walk price simulation so demos remain reliable without API keys or network access. Optional live provider mode can be enabled with:

```bash
LIVE_MARKET_DATA=true
```

When live mode is enabled, the app attempts to refresh external provider prices and keeps the simulation as a fallback. The source labels in API responses map provider roles from the report:

- `yahoo-finance` or `simulated-yahoo` for US stocks
- `simulated-bist` for BIST symbols
- `coingecko` or `simulated-coingecko` for crypto
- `frankfurter` or `simulated-frankfurter` for forex

BIST remains simulated in this MVP because most official BIST feeds are paid or require brokerage/provider credentials.
