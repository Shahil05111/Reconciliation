/**
 * Standardised API response shapes
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
  timestamp: string;
  path?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  correlationId?: string;
  fields?: Array<{ field: string; message: string }>;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  source?: string;
  [key: string]: unknown;
}

export class ResponseFormatter {
  /**
   * 200 / 201 success response
   */
  static success<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
    return {
      success: true,
      data,
      meta,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Paginated success response
   */
  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Error response
   */
  static error(
    message: string,
    code?: string,
    correlationId?: string,
    path?: string,
  ): ApiResponse<never> {
    return {
      success: false,
      error: { message, code, correlationId },
      timestamp: new Date().toISOString(),
      path,
    };
  }

  /**
   * Validation error response (400)
   */
  static validationError(
    fields: Array<{ field: string; message: string }>,
    correlationId?: string,
  ): ApiResponse<never> {
    return {
      success: false,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        correlationId,
        fields,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Not-found response (404)
   */
  static notFound(
    resource: string,
    correlationId?: string,
  ): ApiResponse<never> {
    return {
      success: false,
      error: {
        message: `${resource} not found`,
        code: "NOT_FOUND",
        correlationId,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
