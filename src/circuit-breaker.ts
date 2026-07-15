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
  halfOpenProbeInFlight: boolean;
}

export class CircuitBreaker {
  readonly failureThreshold: number;
  readonly timeoutMs: number;
  readonly recoveryTimeoutMs: number;
  private failureCount = 0;
  private lastFailureTime = 0;
  private state = CircuitBreakerState.Closed;
  private halfOpenStartTime = 0;
  private halfOpenProbeInFlight = false;

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
      this.halfOpenProbeInFlight = false;
    }
    if (this.state === CircuitBreakerState.Open) {
      throw new VioletCircuitBreakerOpenError(
        "Circuit breaker is open due to repeated communication failures",
        { code: "CIRCUIT_OPEN" },
      );
    }
    const isHalfOpenProbe = this.state === CircuitBreakerState.HalfOpen;
    if (isHalfOpenProbe) {
      if (this.halfOpenProbeInFlight) {
        throw new VioletCircuitBreakerOpenError(
          "Circuit breaker recovery probe is already running",
          { code: "CIRCUIT_OPEN" },
        );
      }
      this.halfOpenProbeInFlight = true;
    }

    try {
      const result = await this.runOperation(operation, isHalfOpenProbe);
      if (isHalfOpenProbe && this.state === CircuitBreakerState.HalfOpen) {
        this.failureCount = 0;
        this.state = CircuitBreakerState.Closed;
        this.halfOpenProbeInFlight = false;
      } else if (this.state === CircuitBreakerState.Closed) {
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      if (!countsAsFailure(error)) {
        if (isHalfOpenProbe) this.halfOpenProbeInFlight = false;
        throw error;
      }
      this.failureCount += 1;
      this.lastFailureTime = performance.now();
      this.halfOpenProbeInFlight = false;
      if (isHalfOpenProbe || this.failureCount >= this.failureThreshold) {
        this.state = CircuitBreakerState.Open;
      }
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
      halfOpenProbeInFlight: this.halfOpenProbeInFlight,
    };
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = CircuitBreakerState.Closed;
    this.halfOpenStartTime = 0;
    this.halfOpenProbeInFlight = false;
  }

  private async runOperation<T>(operation: () => Promise<T>, isHalfOpenProbe: boolean): Promise<T> {
    if (!isHalfOpenProbe || this.recoveryTimeoutMs <= 0) return operation();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("Circuit breaker recovery probe timed out");
        error.name = "TimeoutError";
        reject(error);
      }, this.recoveryTimeoutMs);
    });
    try {
      return await Promise.race([operation(), timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
