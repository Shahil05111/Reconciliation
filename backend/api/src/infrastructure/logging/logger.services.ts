import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { injectable } from "inversify";

import { config } from "../../config";

import {
  APP_CONSTANTS,
  ENVIRONMENTS,
} from "../../shared/constants/app.constants";

// Custom log levels for enterprise applications
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

// Log metadata interface
export interface LogMetadata {
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  duration?: number;
  error?: Error | unknown;
  [key: string]: unknown;
}

@injectable()
export class Logger {
  private logger: winston.Logger;
  private readonly environment: string;
  private readonly serviceName: string;

  constructor() {
    this.environment = config.NODE_ENV || ENVIRONMENTS.DEVELOPMENT;
    this.serviceName = APP_CONSTANTS.APP_NAME;
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    // Custom format for production (JSON structured logs)
    const productionFormat = winston.format.combine(
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss.SSS",
      }),
      winston.format.errors({ stack: true }),
      winston.format.metadata(),
      winston.format.json(),
    );

    // Custom format for development (pretty printed with colors)
    const developmentFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss.SSS",
      }),
      winston.format.errors({ stack: true }),
      winston.format.printf(
        ({ timestamp, level, message, metadata, stack, ...rest }) => {
          let logMessage = `${timestamp} [${level}]: ${message}`;

          if (metadata && Object.keys(metadata).length > 0) {
            logMessage += `\n📦 Metadata: ${JSON.stringify(metadata, null, 2)}`;
          }

          if (stack) {
            logMessage += `\n🔥 Stack Trace:\n${stack}`;
          }

          if (Object.keys(rest).length > 0) {
            logMessage += `\n📝 Additional: ${JSON.stringify(rest, null, 2)}`;
          }

          return logMessage;
        },
      ),
    );

    // Console transport
    const consoleTransport = new winston.transports.Console({
      format:
        this.environment === ENVIRONMENTS.PRODUCTION
          ? productionFormat
          : developmentFormat,
      level: this.environment === ENVIRONMENTS.PRODUCTION ? "info" : "debug",
    });

    // File transports with rotation
    const fileTransports = this.createFileTransports();

    // Create logger instance
    const logger = winston.createLogger({
      level: this.getLogLevel(),
      levels: LOG_LEVELS,
      defaultMeta: {
        service: this.serviceName,
        environment: this.environment,
        pid: process.pid,
        hostname: require("os").hostname(),
      },
      transports: [consoleTransport, ...fileTransports],
      exceptionHandlers: [
        new winston.transports.File({
          filename: "logs/exceptions.log",
          handleExceptions: true,
          handleRejections: true,
        }),
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: "logs/rejections.log",
          handleRejections: true,
        }),
      ],
      exitOnError: false,
    });

    return logger;
  }

  private createFileTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    // Error log rotation
    transports.push(
      new DailyRotateFile({
        filename: "logs/error-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        level: "error",
        maxSize: "20m",
        maxFiles: "14d",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );

    // Combined log rotation
    transports.push(
      new DailyRotateFile({
        filename: "logs/combined-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        maxSize: "20m",
        maxFiles: "14d",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );

    // HTTP request log rotation (separate file for requests)
    if (this.environment !== ENVIRONMENTS.DEVELOPMENT) {
      transports.push(
        new DailyRotateFile({
          filename: "logs/http-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          level: "http",
          maxSize: "50m",
          maxFiles: "7d",
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    // Audit log (for compliance)
    transports.push(
      new DailyRotateFile({
        filename: "logs/audit-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        level: "info",
        maxSize: "100m",
        maxFiles: "30d",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );

    return transports;
  }

  private getLogLevel(): string {
    if (this.environment === ENVIRONMENTS.PRODUCTION) {
      return "info";
    }
    if (this.environment === ENVIRONMENTS.STAGING) {
      return "debug";
    }
    return "debug";
  }

  // Core logging methods
  public error(message: string, metadata?: LogMetadata): void {
    this.logger.error(message, this.sanitizeMetadata(metadata));
  }

  public warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(message, this.sanitizeMetadata(metadata));
  }

  public info(message: string, metadata?: LogMetadata): void {
    this.logger.info(message, this.sanitizeMetadata(metadata));
  }

  public http(message: string, metadata?: LogMetadata): void {
    this.logger.log("http", message, this.sanitizeMetadata(metadata));
  }

  public debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(message, this.sanitizeMetadata(metadata));
  }

  public trace(message: string, metadata?: LogMetadata): void {
    this.logger.log("trace", message, this.sanitizeMetadata(metadata));
  }

  // Business-specific logging methods
  public audit(
    action: string,
    userId: string,
    details: Record<string, unknown>,
  ): void {
    this.info(`AUDIT: ${action}`, {
      userId,
      auditAction: action,
      auditDetails: details,
      timestamp: new Date().toISOString(),
    });
  }

  public performance(
    operation: string,
    durationMs: number,
    metadata?: LogMetadata,
  ): void {
    this.info(`PERFORMANCE: ${operation}`, {
      operation,
      durationMs,
      performanceMetric: true,
      ...metadata,
    });
  }

  public security(
    event: string,
    userId?: string,
    details?: Record<string, unknown>,
  ): void {
    this.warn(`SECURITY: ${event}`, {
      userId,
      securityEvent: event,
      securityDetails: details,
    });
  }

  public businessEvent(event: string, data: Record<string, unknown>): void {
    this.info(`BUSINESS: ${event}`, {
      businessEvent: event,
      businessData: data,
    });
  }

  // Utility methods
  private sanitizeMetadata(metadata?: LogMetadata): Record<string, unknown> {
    if (!metadata) return {};

    // Remove sensitive data
    const sanitized = { ...metadata };
    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "authorization",
      "apiKey",
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    // Handle error objects
    if (metadata.error && metadata.error instanceof Error) {
      sanitized.error = {
        name: metadata.error.name,
        message: metadata.error.message,
        stack:
          this.environment !== ENVIRONMENTS.PRODUCTION
            ? metadata.error.stack
            : undefined,
      };
    }

    return sanitized;
  }

  public child(metadata: Record<string, unknown>): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(metadata);
    return childLogger;
  }

  // For testing purposes
  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}

// Singleton instance for non-DI usage
export const logger = new Logger();
