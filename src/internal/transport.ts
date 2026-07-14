import { isIP } from "node:net";

import { Agent, fetch as undiciFetch } from "undici";
import type { Dispatcher, HeadersInit, RequestInit } from "undici";

import { CircuitBreaker } from "../circuit-breaker.js";
import {
  VioletAuthError,
  VioletPayloadError,
  VioletPoolError,
  VioletTimeoutError,
} from "../errors.js";
import { getGlobalRateLimiter, type RateLimiter } from "../rate-limiter.js";
import type { FetchImplementation, VioletPoolClientOptions } from "../types.js";

interface TransportRequestOptions {
  method?: "GET" | "POST";
  parameters?: Readonly<Record<string, string | number | boolean>>;
  query?: string;
  json?: unknown;
  form?: Readonly<Record<string, string | number | boolean>>;
  expectJson?: boolean;
}

class DeterministicHttpError extends VioletPoolError {}

class RetryableRequestError extends Error {
  constructor(readonly publicError: VioletPoolError) {
    super(publicError.message, { cause: publicError });
  }
}

function buildBaseUrl(hostInput: string, useSsl: boolean): string {
  const value = hostInput.trim();
  if (value.length === 0 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(`Invalid hostname format: ${hostInput}`);
  }

  let host = value;
  if (/^https?:\/\//i.test(value)) {
    const supplied = new URL(value);
    if (supplied.username || supplied.password || supplied.search || supplied.hash) {
      throw new TypeError(`Invalid hostname format: ${hostInput}`);
    }
    if (supplied.pathname !== "/" && supplied.pathname !== "") {
      throw new TypeError(`Invalid hostname format: ${hostInput}`);
    }
    host = supplied.host;
  }

  if (/[/?#\\@]/.test(host) || host.includes("..") || host.includes("//")) {
    throw new TypeError(`Invalid hostname format: ${hostInput}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(`${useSsl ? "https" : "http"}://${host}`);
  } catch (error) {
    throw new TypeError(`Invalid hostname format: ${hostInput}`, { cause: error });
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (hostname.length === 0 || hostname.length > 253) {
    throw new TypeError(`Invalid hostname format: ${hostInput}`);
  }
  if (isIP(hostname) === 0 && !/^[a-zA-Z0-9.-]+$/.test(hostname)) {
    throw new TypeError(`Invalid hostname format: ${hostInput}`);
  }
  if (parsed.port !== "") {
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new RangeError(`Invalid port in hostname: ${hostInput}`);
    }
  }
  return `${parsed.protocol}//${parsed.host}`;
}

function endpointUrl(baseUrl: string, endpoint: string, query?: string): string {
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (
    normalized.includes("..") ||
    normalized.includes("://") ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new TypeError(`Invalid API endpoint: ${endpoint}`);
  }
  const url = `${baseUrl}${normalized}`;
  return query === undefined || query.length === 0 ? url : `${url}?${query}`;
}

function retryAfterMilliseconds(value: string | null): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - Date.now());
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class HttpTransport {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly fetch: FetchImplementation;
  private readonly dispatcher: Dispatcher;
  private readonly ownedDispatcher: Agent | undefined;
  private readonly authorization: string | undefined;
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker = new CircuitBreaker();

  constructor(options: VioletPoolClientOptions) {
    this.baseUrl = buildBaseUrl(options.host, options.useSsl ?? false);
    this.timeoutMs = Math.max(1_000, Math.trunc(options.timeoutMs ?? 10_000));
    this.maxRetries = Math.max(1, Math.trunc(options.maxRetries ?? 3));
    this.retryBaseDelayMs = Math.max(0, Math.trunc(options.retryBaseDelayMs ?? 10_000));
    this.fetch = options.fetch ?? undiciFetch;
    this.rateLimiter = getGlobalRateLimiter();
    if (options.dispatcher !== undefined) {
      this.dispatcher = options.dispatcher;
      this.ownedDispatcher = undefined;
    } else {
      const agent = new Agent({ connect: { rejectUnauthorized: options.verifySsl ?? true } });
      this.dispatcher = agent;
      this.ownedDispatcher = agent;
    }
    this.authorization =
      options.username === undefined
        ? undefined
        : `Basic ${Buffer.from(`${options.username}:${options.password ?? ""}`, "utf8").toString("base64")}`;
  }

  async request(endpoint: string, options: TransportRequestOptions = {}): Promise<unknown> {
    if (options.parameters !== undefined && options.query !== undefined) {
      throw new TypeError("'parameters' and 'query' are mutually exclusive");
    }
    return this.circuitBreaker.call(
      () => this.execute(endpoint, options),
      (error) => !(error instanceof DeterministicHttpError) && !(error instanceof VioletAuthError),
    );
  }

  async close(): Promise<void> {
    await this.ownedDispatcher?.close();
  }

  private async execute(endpoint: string, options: TransportRequestOptions): Promise<unknown> {
    await this.rateLimiter.wait();
    const parameterQuery =
      options.parameters === undefined
        ? undefined
        : new URLSearchParams(
            Object.entries(options.parameters).map(([key, value]): [string, string] => [
              key,
              String(value),
            ]),
          ).toString();
    const url = endpointUrl(this.baseUrl, endpoint, options.query ?? parameterQuery);

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.singleRequest(url, endpoint, options);
      } catch (error) {
        if (!(error instanceof RetryableRequestError)) throw error;
        if (attempt === this.maxRetries) throw error.publicError;
        const retryAfter =
          error.publicError.code?.startsWith("RETRY_AFTER:") === true
            ? Number(error.publicError.code.slice("RETRY_AFTER:".length))
            : undefined;
        const exponential = Math.min(300_000, this.retryBaseDelayMs * 2 ** (attempt - 1));
        const jitter = Math.random() * exponential * 0.1;
        await delay(retryAfter ?? exponential + jitter);
      }
    }
    throw new VioletPoolError("All retry attempts exhausted", { endpoint });
  }

  private async singleRequest(
    url: string,
    endpoint: string,
    options: TransportRequestOptions,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Request timeout")), this.timeoutMs);
    const headers: HeadersInit = {
      accept: options.expectJson === true ? "application/json" : "*/*",
      "user-agent": "violet-poolcontroller/0.1.0",
    };
    if (this.authorization !== undefined) headers.authorization = this.authorization;

    let body: RequestInit["body"];
    if (options.form !== undefined) {
      body = new URLSearchParams(
        Object.entries(options.form).map(([key, value]): [string, string] => [key, String(value)]),
      );
      headers["content-type"] = "application/x-www-form-urlencoded;charset=UTF-8";
    } else if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers["content-type"] = "application/json";
    }

    try {
      const response = await this.fetch(url, {
        method: options.method ?? "GET",
        headers,
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
        dispatcher: this.dispatcher,
      });
      const text = await response.text();

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = retryAfterMilliseconds(response.headers.get("retry-after"));
        throw new RetryableRequestError(
          new VioletPoolError(`HTTP ${response.status} for ${endpoint}: ${text.trim()}`, {
            code: retryAfter === undefined ? "HTTP_RETRYABLE" : `RETRY_AFTER:${retryAfter}`,
            status: response.status,
            endpoint,
          }),
        );
      }

      if (response.status >= 400) {
        const ErrorType =
          response.status === 401 || response.status === 403
            ? VioletAuthError
            : DeterministicHttpError;
        throw new ErrorType(`HTTP ${response.status} for ${endpoint}: ${text.trim()}`, {
          code: "HTTP_CLIENT_ERROR",
          status: response.status,
          endpoint,
        });
      }

      if (options.expectJson !== true) return text;
      try {
        return JSON.parse(text) as unknown;
      } catch (error) {
        throw new VioletPayloadError(`Invalid JSON payload for ${endpoint}: ${text.trim()}`, {
          code: "INVALID_JSON",
          endpoint,
          cause: error,
        });
      }
    } catch (error) {
      if (
        error instanceof RetryableRequestError ||
        error instanceof DeterministicHttpError ||
        error instanceof VioletAuthError ||
        error instanceof VioletPayloadError
      ) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new RetryableRequestError(
          new VioletTimeoutError(`Request to ${endpoint} timed out after ${this.timeoutMs} ms`, {
            code: "TIMEOUT",
            endpoint,
            cause: error,
          }),
        );
      }
      throw new RetryableRequestError(
        new VioletPoolError("Error communicating with Violet controller", {
          code: "NETWORK_ERROR",
          endpoint,
          cause: error,
        }),
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
