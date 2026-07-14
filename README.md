# Violet Pool Controller

[![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://github.com/Xerolux/violet-poolcontroller-node/actions/workflows/ci.yml/badge.svg)](https://github.com/Xerolux/violet-poolcontroller-node/actions/workflows/ci.yml)
[![License: AGPL v3+](https://img.shields.io/badge/License-AGPL_v3%2B-blue)](LICENSE)

An asynchronous, typed Node.js client for the Violet Pool Controller HTTP API.

This is the Node.js counterpart of
[`violet-poolController-api`](https://github.com/Xerolux/violet-poolController-api).
It supports Node.js 24 or newer and ships ESM, CommonJS, and TypeScript declarations.

## Installation

```bash
npm install violet-poolcontroller
```

## Usage

```ts
import { VioletPoolClient, VioletPoolError } from "violet-poolcontroller";

const client = new VioletPoolClient({
  host: "192.0.2.10",
  username: "admin",
  password: "secret",
});

try {
  const readings = await client.getReadings();
  console.log(readings.ph, readings.orp, readings.pump);

  await client.setPumpSpeed(2);
  await client.setDeviceTemperature("HEATER", 28.5);
} catch (error) {
  if (error instanceof VioletPoolError) {
    console.error(error.code, error.message);
  }
} finally {
  await client.close();
}
```

`host` accepts a hostname or IP address with an optional port. HTTP is used by default. Enable
HTTPS explicitly:

```ts
const client = new VioletPoolClient({
  host: "pool-controller.example.test",
  useSsl: true,
  verifySsl: true,
});
```

Disabling certificate verification is supported for trusted networks with self-signed
certificates, but weakens transport security:

```ts
const client = new VioletPoolClient({
  host: "192.0.2.10",
  useSsl: true,
  verifySsl: false,
});
```

## Typed readings

`getReadings()` returns an immutable `VioletReadings` snapshot. Typed accessors coexist with raw
firmware fields:

```ts
const readings = await client.getReadings();

console.log(readings.ph);
console.log(readings.pumpRuntimeMilliseconds);
console.log(readings.onewireTemperatures[1]);
console.log(readings.get("firmware_specific_key"));
console.log(readings.raw);
```

The client automatically normalizes both controller response formats:

- base-module object responses;
- dosing-standalone list responses.

Relay keys for absent extension modules are removed using the module alive-counter fields.

## Dosing standalone

```ts
const client = new VioletPoolClient({
  host: "192.0.2.10",
  dosingStandalone: true,
});

await client.manualDosing("Chlor", 120);
```

The response format also updates `client.dosingStandalone` automatically. Base-module functions
are rejected in standalone mode.

## Safety acknowledgements

Cover movement requires the same explicit acknowledgement as the Python reference client:

```ts
await client.setCoverCommand("OPEN", { acknowledgeUnsafe: true });
```

Do not expose these calls without physical safety controls and independent monitoring.

## Resilience

The client includes:

- Basic Authentication;
- request timeouts and cancellation;
- bounded retry with exponential backoff and jitter;
- `Retry-After` support for HTTP 429;
- a circuit breaker for transient communication failures;
- a process-wide token-bucket rate limiter;
- strict host, endpoint, configuration-key, and setpoint validation;
- separate error classes for authentication, timeout, payload, range, and unsafe-operation errors.

HTTP 4xx responses fail immediately. They are not retried and do not count toward the circuit
breaker. Network errors, timeouts, HTTP 429, and HTTP 5xx responses are retryable. Retry timing
matches the Python default of 10 seconds with exponential backoff and a 300-second cap.

## Development

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm pack --dry-run
```

The tests use a local stateful Node.js mock server and do not require controller hardware.

## Upstream parity

The Python package is the source of truth. `parity/upstream.json` records the reviewed upstream
commit and its Python-to-TypeScript name mapping. The parity check extracts the public contract
from a clean Python checkout and verifies:

- every public `VioletPoolAPI` member and package export;
- all controller endpoint paths and action constants;
- the complete controller error-code catalog;
- the reviewed upstream commit and package version.

GitHub Actions checks the current Python `main` branch on every push and once per day. If upstream
changes, CI fails until the TypeScript implementation, tests, and parity manifest are updated
together. Run the same guard locally after building:

```bash
npm run parity:check -- --upstream-dir ../violet-poolController-api
```

Use a clean checkout of the Python repository for this command.

See [PORTING_MATRIX.md](PORTING_MATRIX.md) for the Python-to-TypeScript API mapping and current
port status.

## License

GNU Affero General Public License v3.0 or later.

This is an unofficial community project. It is not affiliated with, endorsed by, or associated
with PoolDigital GmbH & Co. KG. VIOLET and related trademarks belong to their respective owners.

## Safety warning

This software controls physical equipment and water chemistry. Incorrect commands, invalid
configuration, network failures, or software defects can cause unsafe water conditions, equipment
damage, injury, or property loss. Monitor pool chemistry and hardware independently. Use this
software at your own risk.
