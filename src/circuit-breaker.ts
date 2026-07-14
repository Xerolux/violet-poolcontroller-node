import { VioletCircuitBreakerOpenError } from "./errors.js";

export enum CircuitBreakerState {
  Closed = "CLOSED",
  Open = "OPEN",
  HalfOpen = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  timeoutMs?: number;
  recoveryTimeoutMs?: number;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  failureThreshold: number;
  timeoutMs: number;
  recoveryTimeoutMs: number;
  lastFailureTime: number;
  halfOpenStartTime: number;
}

export class CircuitBreaker {
  readonly failureThreshold: number;
  readonly timeoutMs: number;
  readonly recoveryTimeoutMs: number;
  private failureCount = 0;
  private lastFailureTime = 0;
  private state = CircuitBreakerState.Closed;
  private halfOpenStartTime = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 300_000;
  }

  async call<T>(
    operation: () => Promise<T>,
    countsAsFailure: (error: unknown) => boolean = () => true,
  ): Promise<T> {
    const now = performance.now();
    if (this.state === CircuitBreakerState.Open && now - this.lastFailureTime > this.timeoutMs) {
      this.state = CircuitBreakerState.HalfOpen;
      this.halfOpenStartTime = now;
    }
    if (this.state === CircuitBreakerState.Open) {
      throw new VioletCircuitBreakerOpenError(
        "Circuit breaker is open due to repeated communication failures",
        { code: "CIRCUIT_OPEN" },
      );
    }

    try {
      const result = await operation();
      this.failureCount = 0;
      this.state = CircuitBreakerState.Closed;
      return result;
    } catch (error) {
      if (!countsAsFailure(error)) throw error;
      this.failureCount += 1;
      this.lastFailureTime = performance.now();
      if (this.failureCount >= this.failureThreshold) this.state = CircuitBreakerState.Open;
      throw error;
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      timeoutMs: this.timeoutMs,
      recoveryTimeoutMs: this.recoveryTimeoutMs,
      lastFailureTime: this.lastFailureTime,
      halfOpenStartTime: this.halfOpenStartTime,
    };
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = CircuitBreakerState.Closed;
    this.halfOpenStartTime = 0;
  }
}
