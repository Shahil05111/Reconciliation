import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      requestStartTime: number;
    }
  }
}

// Configuration options
interface CorrelationIdOptions {
  headerName?: string;
  generateNewIfMissing?: boolean;
  validateExisting?: boolean;
  logCorrelationId?: boolean;
}

export class CorrelationIdMiddleware {
  private static readonly DEFAULT_HEADER = "x-correlation-id";
  private static readonly ALTERNATIVE_HEADERS = [
    "x-request-id",
    "x-correlation-id",
    "correlation-id",
    "request-id",
  ];

  /**
   * Main middleware to handle correlation IDs
   */
  static middleware(options: CorrelationIdOptions = {}) {
    const {
      headerName = CorrelationIdMiddleware.DEFAULT_HEADER,
      generateNewIfMissing = true,
      validateExisting = true,
      logCorrelationId = true,
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
      // Get or generate correlation ID
      let correlationId = CorrelationIdMiddleware.extractCorrelationId(
        req,
        headerName,
        validateExisting,
      );

      // Generate new if missing and configured to do so
      if (!correlationId && generateNewIfMissing) {
        correlationId = CorrelationIdMiddleware.generateCorrelationId();
      }

      // Attach to request object
      req.correlationId = correlationId || "unknown";
      req.requestStartTime = Date.now();

      // Set response header
      if (correlationId) {
        res.setHeader(headerName, correlationId);

        // Also set alternative headers for compatibility
        CorrelationIdMiddleware.ALTERNATIVE_HEADERS.forEach((header) => {
          if (header !== headerName) {
            res.setHeader(header, correlationId);
          }
        });
      }

      // Log correlation ID for debugging
      if (logCorrelationId && process.env.NODE_ENV !== "production") {
        console.log(
          `[CorrelationId] ${req.method} ${req.path} -> ${correlationId}`,
        );
      }

      next();
    };
  }

  /**
   * Extract correlation ID from various headers
   */
  private static extractCorrelationId(
    req: Request,
    preferredHeader: string,
    validate: boolean,
  ): string | null {
    // Check preferred header first
    let correlationId = req.headers[preferredHeader.toLowerCase()] as string;

    if (correlationId && (!validate || this.isValidUuid(correlationId))) {
      return correlationId;
    }

    // Check alternative headers
    for (const header of this.ALTERNATIVE_HEADERS) {
      const value = req.headers[header.toLowerCase()] as string;
      if (value && (!validate || this.isValidUuid(value))) {
        return value;
      }
    }

    return null;
  }

  /**
   * Generate a new correlation ID (UUID v4)
   */
  static generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * Validate if string is a valid UUID
   */
  static isValidUuid(id: string): boolean {
    return uuidValidate(id);
  }

  /**
   * Create a child logger with correlation ID context
   */
  static createChildLogger(correlationId: string, logger: any): any {
    return logger.child({ correlationId });
  }
}

// Simplified middleware function for easy use
export const correlationIdMiddleware = CorrelationIdMiddleware.middleware();

// Advanced middleware with custom options
export const createCorrelationIdMiddleware = (options: CorrelationIdOptions) =>
  CorrelationIdMiddleware.middleware(options);
