import { describe, expect, it } from "vitest";

import {
  CircuitBreaker,
  CircuitBreakerState,
  RateLimiter,
  VioletCircuitBreakerOpenError,
} from "../src/index.js";

describe("resilience primitives", () => {
  it("opens and resets the circuit breaker", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, timeoutMs: 60_000 });
    const failure = async (): Promise<never> => Promise.reject(new Error("offline"));

    await expect(breaker.call(failure)).rejects.toThrow("offline");
    await expect(breaker.call(failure)).rejects.toThrow("offline");
    expect(breaker.getStats().state).toBe(CircuitBreakerState.Open);
    await expect(breaker.call(() => Promise.resolve("ok"))).rejects.toBeInstanceOf(
      VioletCircuitBreakerOpenError,
    );
    breaker.reset();
    await expect(breaker.call(() => Promise.resolve("ok"))).resolves.toBe("ok");
  });

  it("limits bursts with a token bucket", () => {
    const limiter = new RateLimiter({ maxRequests: 1, timeWindowMs: 60_000, burstSize: 1 });
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);
    expect(limiter.getStats().blockedRequests).toBe(1);
  });
});
