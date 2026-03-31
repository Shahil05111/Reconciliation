import { BaseException } from "./BaseException";

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export class ValidationException extends BaseException {
  public readonly fields: ValidationError[];

  constructor(
    message: string,
    fields: ValidationError[] = [],
    correlationId?: string,
  ) {
    super(message, 400, true, correlationId, { fields });
    this.name = "ValidationException";
    this.fields = fields;
  }

  static fromField(
    field: string,
    message: string,
    correlationId?: string,
  ): ValidationException {
    return new ValidationException(
      `Validation failed: ${field}`,
      [{ field, message }],
      correlationId,
    );
  }

  static fromFields(
    errors: ValidationError[],
    correlationId?: string,
  ): ValidationException {
    return new ValidationException("Validation failed", errors, correlationId);
  }
}
