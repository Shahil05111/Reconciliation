export abstract class BaseException extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly correlationId?: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    correlationId?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.correlationId = correlationId;
    this.metadata = metadata;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseException extends BaseException {
  constructor(
    message: string,
    correlationId?: string,
    originalError?: unknown,
  ) {
    super(message, 503, true, correlationId, { originalError });
    this.name = "DatabaseException";
  }
}

export class NotFoundException extends BaseException {
  constructor(resource: string, correlationId?: string) {
    super(`${resource} not found`, 404, true, correlationId);
    this.name = "NotFoundException";
  }
}
