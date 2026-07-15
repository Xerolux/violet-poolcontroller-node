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

  it("releases queued rate-limiter requests by priority and then FIFO", async () => {
    const limiter = new RateLimiter({
      maxRequests: 1,
      timeWindowMs: 20,
      burstSize: 0,
      retryAfterMs: 10,
    });
    expect(limiter.acquire()).toBe(true);
    const completed: string[] = [];
    const low = limiter.wait({ priority: 4, timeoutMs: 1_000 }).then(() => completed.push("low"));
    await Promise.resolve();
    const critical = limiter
      .wait({ priority: 1, timeoutMs: 1_000 })
      .then(() => completed.push("critical"));

    await Promise.all([low, critical]);
    expect(completed).toEqual(["critical", "low"]);
  });

  it("keeps stats reads side-effect free and rejects invalid limiter configuration", () => {
    const limiter = new RateLimiter();
    expect(limiter.getStats().totalRequests).toBe(0);
    expect(limiter.getStats().totalRequests).toBe(0);
    expect(() => new RateLimiter({ maxRequests: 0 })).toThrow(/maxRequests/);
    expect(() => new RateLimiter({ timeWindowMs: 0 })).toThrow(/timeWindowMs/);
    expect(() => new RateLimiter({ burstSize: -1 })).toThrow(/burstSize/);
    expect(() => new RateLimiter({ retryAfterMs: 0 })).toThrow(/retryAfterMs/);
  });

  it("allows only one half-open recovery probe", async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      timeoutMs: 0,
      recoveryTimeoutMs: 1_000,
    });
    await expect(breaker.call(() => Promise.reject(new Error("offline")))).rejects.toThrow(
      "offline",
    );
    await new Promise((resolve) => setTimeout(resolve, 1));
    let release: (() => void) | undefined;
    const probe = breaker.call(
      () =>
        new Promise<string>((resolve) => {
          release = (): void => resolve("ok");
        }),
    );
    await Promise.resolve();

    await expect(breaker.call(() => Promise.resolve("second"))).rejects.toThrow(/probe/);
    release?.();
    await expect(probe).resolves.toBe("ok");
    expect(breaker.getStats().state).toBe(CircuitBreakerState.Closed);
  });

  it("reopens when the half-open recovery probe times out", async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      timeoutMs: 0,
      recoveryTimeoutMs: 5,
    });
    await expect(breaker.call(() => Promise.reject(new Error("offline")))).rejects.toThrow(
      "offline",
    );
    await new Promise((resolve) => setTimeout(resolve, 1));

    await expect(breaker.call(() => new Promise(() => undefined))).rejects.toMatchObject({
      name: "TimeoutError",
    });
    expect(breaker.getStats()).toMatchObject({
      state: CircuitBreakerState.Open,
      halfOpenProbeInFlight: false,
    });
  });
});
