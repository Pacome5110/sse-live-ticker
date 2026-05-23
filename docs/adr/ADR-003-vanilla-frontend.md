# ADR-003: Use Vanilla Frontend for the MVP

## Status

Accepted

## Context

The dashboard is a compact single-page interface: ticker table, filters, chart modal, auth modal, watchlist, alerts, language toggle, and theme toggle. The project can meet the learning goals without a component framework.

## Decision

Use static HTML, CSS, and browser JavaScript with native APIs. Use Lightweight Charts only for candlestick visualization.

## Consequences

- The bundle remains small and easy to inspect for a course submission.
- There is no build step, so deployment is simpler.
- As the UI grows, moving to React or Vue may become useful for component state and testability.
