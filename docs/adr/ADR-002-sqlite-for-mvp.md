# ADR-002: Use SQLite for MVP Persistence

## Status

Accepted

## Context

The final project needs user accounts, watchlists, alerts, and refresh tokens. The application is a single-node MVP demo, so operational simplicity matters more than horizontal database scaling.

## Decision

Use SQLite through `better-sqlite3` for local persistence.

## Consequences

- The project can run with one command and no external database account.
- SQL queries are parameterized, which reduces injection risk.
- Production deployment must either persist the SQLite volume or migrate to PostgreSQL before multi-instance scaling.
