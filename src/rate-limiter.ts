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

export class RateLimiter {
  readonly maxRequests: number;
  readonly timeWindowMs: number;
  readonly burstSize: number;
  readonly retryAfterMs: number;
  private tokens: number;
  private lastRefill = performance.now();
  private totalRequests = 0;
  private blockedRequests = 0;
  private lastKnownTokens = 0;
  private lastCleanupTime = performance.now();
  private recentRequests = 0;
  private recentBlocked = 0;
  private recentResetTime = performance.now();
  private readonly requestHistory: RequestHistoryEntry[] = [];

  constructor(options: RateLimiterOptions = {}) {
    this.maxRequests = options.maxRequests ?? 10;
    this.timeWindowMs = options.timeWindowMs ?? 1_000;
    this.burstSize = options.burstSize ?? 3;
    this.retryAfterMs = options.retryAfterMs ?? 100;
    this.tokens = this.maxRequests + this.burstSize;
  }

  acquire(priority = 3): boolean {
    const now = performance.now();
    this.totalRequests += 1;
    if (now - this.lastCleanupTime > 300_000) {
      this.cleanupHistory(now);
      this.lastCleanupTime = now;
    }
    this.updateRecentStats(now);
    this.refill(now);

    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.requestHistory.push({ time: now, priority, blocked: false });
      if (this.requestHistory.length > 500) this.requestHistory.shift();
      return true;
    }

    this.blockedRequests += 1;
    this.recentBlocked += 1;
    this.lastKnownTokens = this.tokens;
    return false;
  }

  async wait(
    options: { priority?: number; timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 10_000;
    const started = performance.now();
    while (!this.acquire(options.priority ?? 3)) {
      if (performance.now() - started >= timeoutMs) {
        throw new Error(`Rate limiter timeout after ${timeoutMs} ms`);
      }
      const refillRate = this.maxRequests / this.timeWindowMs;
      const neededTokens = 1 - this.lastKnownTokens;
      const optimalWait = refillRate > 0 ? neededTokens / refillRate : this.retryAfterMs;
      await this.delay(Math.min(optimalWait, this.retryAfterMs), options.signal);
    }
  }

  getStats(): RateLimiterStats {
    const now = performance.now();
    this.updateRecentStats(now);
    this.refill(now);
    return {
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
      recentRequests1Minute: this.recentRequests,
      recentBlocked1Minute: this.recentBlocked,
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
    this.lastKnownTokens = 0;
    this.requestHistory.length = 0;
    this.recentRequests = 0;
    this.recentBlocked = 0;
    this.recentResetTime = performance.now();
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

  private updateRecentStats(now: number): void {
    if (now - this.recentResetTime > 60_000) {
      this.recentRequests = 0;
      this.recentBlocked = 0;
      this.recentResetTime = now;
    }
    this.recentRequests += 1;
  }

  private delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(signal?.reason instanceof Error ? signal.reason : new Error("Aborted"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, milliseconds);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

let globalRateLimiter: RateLimiter | undefined;

export function getGlobalRateLimiter(): RateLimiter {
  globalRateLimiter ??= new RateLimiter();
  return globalRateLimiter;
}
