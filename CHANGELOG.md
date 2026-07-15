# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-07-15

- Add the initial Node.js 24 and TypeScript implementation.
- Add ESM, CommonJS, and bundled declaration outputs.
- Port controller readings, configuration, switching, dosing, service, RS485, update, and
  diagnostics operations.
- Add validation, Basic Auth, TLS options, retry, rate limiting, and circuit breaking.
- Add typed readings and state helpers.
- Add a stateful Node.js mock server, wire-contract integration tests, and enforced coverage
  thresholds.
- Add a daily CI parity guard for the Python client surface, exports, endpoints, actions, and full
  controller error catalog.
- Match upstream request hardening with per-client rate limiting, safe retry semantics, strict
  actuator durations, finite numeric parsing, and single-probe circuit-breaker recovery.
