# ADR-001: Use Server-Sent Events for Live Market Updates

## Status

Accepted

## Context

The project needs one-way, low-latency price updates from the server to many browser clients. Users do not need to send high-frequency messages back to the server while watching the ticker.

## Decision

Use Server-Sent Events through the native browser `EventSource` API and Node.js response streams.

## Consequences

- The frontend receives automatic reconnect behavior without a WebSocket client library.
- The backend stays simple because each update is a text event written to subscribed HTTP responses.
- SSE is one-way, so future bidirectional workflows such as live trading chat would require REST commands or WebSockets.
