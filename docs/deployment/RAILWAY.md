# Railway Deployment Guide

This project is ready for Railway deployment with `railway.json`.

## Required Variables

Set these variables in Railway:

| Variable | Example | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables production behavior. |
| `PORT` | Railway provides this | Do not hardcode in Railway. |
| `JWT_SECRET` | long random string | Required in production. |
| `DB_PATH` | `/data/ticker.db` | Use this when a Railway volume is mounted at `/data`. |
| `ACCESS_TOKEN_TTL` | `15m` | Report target. |
| `REFRESH_TOKEN_DAYS` | `7` | Report target. |
| `BCRYPT_COST` | `12` | Report target. |
| `AUTH_RATE_LIMIT_MAX` | `5` | Per minute per IP. |
| `API_RATE_LIMIT_MAX` | `100` | Per minute per IP. |
| `LIVE_MARKET_DATA` | `false` | Keep false for reliable demos, true for external provider attempts. |

## Persistent SQLite

SQLite needs persistent storage in production. In Railway:

1. Add a volume to the service.
2. Mount it at `/data`.
3. Set `DB_PATH=/data/ticker.db`.

Without a volume, user accounts, watchlists, alerts, and refresh tokens may be lost after redeploys.

## Deployment Steps

```bash
npm test
npm run a11y
railway login
railway link
railway up
```

After deployment:

1. Open the public Railway URL.
2. Check `/api/health`.
3. Register a demo user.
4. Add a watchlist symbol.
5. Create and delete a price alert.
6. Capture the deployed URL and health-check result for the final report.

## PostgreSQL Migration Option

For multi-instance production, replace SQLite with PostgreSQL. The tables map directly:

- `users`
- `favorites`
- `alerts`
- `refresh_tokens`

The API layer already uses parameterized queries, so the migration mainly requires replacing `better-sqlite3` calls with a PostgreSQL client and adjusting SQL syntax for `RETURNING` and timestamps.
