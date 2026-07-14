export interface VioletErrorOptions {
  code?: string;
  status?: number;
  endpoint?: string;
  cause?: unknown;
}

export class VioletPoolError extends Error {
  override readonly name: string = "VioletPoolError";
  readonly code: string | undefined;
  readonly status: number | undefined;
  readonly endpoint: string | undefined;

  constructor(message: string, options: VioletErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.code = options.code;
    this.status = options.status;
    this.endpoint = options.endpoint;
  }
}

export class VioletAuthError extends VioletPoolError {
  override readonly name = "VioletAuthError";
}

export class VioletTimeoutError extends VioletPoolError {
  override readonly name = "VioletTimeoutError";
}

export class VioletPayloadError extends VioletPoolError {
  override readonly name = "VioletPayloadError";
}

export class VioletSetpointError extends VioletPoolError {
  override readonly name = "VioletSetpointError";
}

export class VioletUnsafeOperationError extends VioletPoolError {
  override readonly name = "VioletUnsafeOperationError";
}

export class VioletCircuitBreakerOpenError extends VioletPoolError {
  override readonly name = "VioletCircuitBreakerOpenError";
}
