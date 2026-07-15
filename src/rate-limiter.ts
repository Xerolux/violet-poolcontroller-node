export interface RateLimiterOptions {
  maxRequests?: number;
  timeWindowMs?: number;
  burstSize?: number;
  retryAfterMs?: number;
}

export interface RateLimiterStats {
  totalRequests: number;
  blockedRequests: number;
  recentRequests1Minute: number;
  recentBlocked1Minute: number;
  currentTokens: number;
  maxTokens: number;
  blockRate: number;
}

interface RequestHistoryEntry {
  time: number;
  priority: number;
  blocked: boolean;
}

interface Waiter {
  priority: number;
  sequence: number;
  wake: (() => void) | undefined;
}

export class RateLimiter {
  readonly maxRequests: number;
  readonly timeWindowMs: number;
  readonly burstSize: number;
  readonly retryAfterMs: number;
  private tokens: number;
  private lastRefill = performance.now();
  private totalRequests = 0;
  private blockedRequests = 0;
  private lastCleanupTime = performance.now();
  private recentRequests = 0;
  private recentBlocked = 0;
  private recentResetTime = performance.now();
  private readonly requestHistory: RequestHistoryEntry[] = [];
  private readonly waiters: Waiter[] = [];
  private waiterSequence = 0;

  constructor(options: RateLimiterOptions = {}) {
    this.maxRequests = options.maxRequests ?? 10;
    this.timeWindowMs = options.timeWindowMs ?? 1_000;
    this.burstSize = options.burstSize ?? 3;
    this.retryAfterMs = options.retryAfterMs ?? 100;
    if (!Number.isFinite(this.maxRequests) || this.maxRequests <= 0) {
      throw new RangeError("maxRequests must be greater than zero");
    }
    if (!Number.isFinite(this.timeWindowMs) || this.timeWindowMs <= 0) {
      throw new RangeError("timeWindowMs must be greater than zero");
    }
    if (!Number.isFinite(this.burstSize) || this.burstSize < 0) {
      throw new RangeError("burstSize must not be negative");
    }
    if (!Number.isFinite(this.retryAfterMs) || this.retryAfterMs <= 0) {
      throw new RangeError("retryAfterMs must be greater than zero");
    }
    this.tokens = this.maxRequests + this.burstSize;
  }

  acquire(priority = 3): boolean {
    const now = performance.now();
    this.recordRequest(now);
    if (this.waiters.length === 0 && this.consumeToken(priority, now)) return true;
    this.recordBlockedRequest();
    return false;
  }

  async wait(
    options: { priority?: number; timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<void> {
    const priority = options.priority ?? 3;
    const timeoutMs = options.timeoutMs ?? 10_000;
    const started = performance.now();
    const now = performance.now();
    this.recordRequest(now);
    if (this.waiters.length === 0 && this.consumeToken(priority, now)) return;
    this.recordBlockedRequest();

    const waiter: Waiter = { priority, sequence: this.waiterSequence, wake: undefined };
    this.waiterSequence += 1;
    const previousHead = this.waiters[0];
    this.waiters.push(waiter);
    this.waiters.sort(
      (left, right) => left.priority - right.priority || left.sequence - right.sequence,
    );
    if (previousHead !== undefined && this.waiters[0] !== previousHead) previousHead.wake?.();

    let queued = true;
    try {
      while (true) {
        if (options.signal?.aborted === true) throw this.abortReason(options.signal);
        const current = performance.now();
        const isHead = this.waiters[0] === waiter;
        if (isHead && this.consumeToken(priority, current)) {
          this.waiters.shift();
          queued = false;
          this.waiters[0]?.wake?.();
          return;
        }

        const elapsed = current - started;
        const remaining = timeoutMs - elapsed;
        if (remaining <= 0) throw new Error(`Rate limiter timeout after ${timeoutMs} ms`);
        const refillRate = this.maxRequests / this.timeWindowMs;
        const neededTokens = Math.max(0, 1 - this.tokens);
        const optimalWait = isHead ? Math.max(neededTokens / refillRate, 1) : this.retryAfterMs;
        await this.pause(
          waiter,
          Math.min(optimalWait, this.retryAfterMs, remaining),
          options.signal,
        );
      }
    } finally {
      if (queued) {
        const index = this.waiters.indexOf(waiter);
        if (index !== -1) {
          const wasHead = index === 0;
          this.waiters.splice(index, 1);
          if (wasHead) this.waiters[0]?.wake?.();
        }
      }
    }
  }

  getStats(): RateLimiterStats {
    const recentWindowExpired = performance.now() - this.recentResetTime > 60_000;
    return {
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
      recentRequests1Minute: recentWindowExpired ? 0 : this.recentRequests,
      recentBlocked1Minute: recentWindowExpired ? 0 : this.recentBlocked,
      currentTokens: this.tokens,
      maxTokens: this.maxRequests + this.burstSize,
      blockRate: this.totalRequests === 0 ? 0 : (this.blockedRequests / this.totalRequests) * 100,
    };
  }

  reset(): void {
    this.tokens = this.maxRequests + this.burstSize;
    this.lastRefill = performance.now();
    this.totalRequests = 0;
    this.blockedRequests = 0;
    this.requestHistory.length = 0;
    this.recentRequests = 0;
    this.recentBlocked = 0;
    this.recentResetTime = performance.now();
    for (const waiter of this.waiters) waiter.wake?.();
  }

  private recordRequest(now: number): void {
    this.totalRequests += 1;
    if (now - this.lastCleanupTime > 300_000) {
      this.cleanupHistory(now);
      this.lastCleanupTime = now;
    }
    if (now - this.recentResetTime > 60_000) {
      this.recentRequests = 0;
      this.recentBlocked = 0;
      this.recentResetTime = now;
    }
    this.recentRequests += 1;
  }

  private recordBlockedRequest(): void {
    this.blockedRequests += 1;
    this.recentBlocked += 1;
  }

  private consumeToken(priority: number, now: number): boolean {
    this.refill(now);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    this.requestHistory.push({ time: now, priority, blocked: false });
    if (this.requestHistory.length > 500) this.requestHistory.shift();
    return true;
  }

  private refill(now: number): void {
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    const refillRate = this.maxRequests / this.timeWindowMs;
    this.tokens = Math.min(this.maxRequests + this.burstSize, this.tokens + elapsed * refillRate);
    this.lastRefill = now;
  }

  private cleanupHistory(now: number): void {
    const cutoff = now - 3_600_000;
    while (this.requestHistory[0]?.time !== undefined && this.requestHistory[0].time <= cutoff) {
      this.requestHistory.shift();
    }
  }

  private pause(waiter: Waiter, milliseconds: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        waiter.wake = undefined;
        if (error === undefined) resolve();
        else reject(error);
      };
      const onAbort = (): void =>
        finish(signal === undefined ? new Error("Aborted") : this.abortReason(signal));
      const timer = setTimeout(() => finish(), milliseconds);
      waiter.wake = (): void => finish();
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted === true) onAbort();
    });
  }

  private abortReason(signal: AbortSignal): Error {
    return signal.reason instanceof Error ? signal.reason : new Error("Aborted");
  }
}

let globalRateLimiter: RateLimiter | undefined;

export function getGlobalRateLimiter(): RateLimiter {
  globalRateLimiter ??= new RateLimiter();
  return globalRateLimiter;
}
