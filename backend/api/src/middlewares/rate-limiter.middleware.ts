import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { ipKeyGenerator } from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import RedisStore from "rate-limit-redis";
import type { RedisReply } from "rate-limit-redis";
import Redis from "ioredis";

// Rate limit configuration interface
interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response, next: NextFunction) => void;
}

// Rate limiters for different endpoints
export class RateLimiterMiddleware {
  private static redisClient: Redis | null = null;

  /**
   * Initialize Redis client for distributed rate limiting
   */
  static initRedis(redisUrl?: string): void {
    if (!this.redisClient && redisUrl) {
      this.redisClient = new Redis(redisUrl);
      console.log("Redis connected for rate limiting");
    }
  }

  /**
   * Default rate limiter for general API endpoints
   */
  static default(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: {
        success: false,
        error: {
          message: "Too many requests, please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
        },
        timestamp: new Date().toISOString(),
      },
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise IP
        return (req as any).user?.id || ipKeyGenerator(req as any);
      },
      skip: (req: Request) => {
        // Skip rate limiting for health checks
        return req.path === "/health";
      },
    });
  }

  /**
   * Strict rate limiter for authentication endpoints
   */
  static auth(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per 15 minutes
      message: {
        success: false,
        error: {
          message: "Too many authentication attempts, please try again later.",
          code: "AUTH_RATE_LIMIT_EXCEEDED",
        },
        timestamp: new Date().toISOString(),
      },
      skipSuccessfulRequests: true, // Don't count successful logins
      keyGenerator: (req: Request) => {
        const email = req.body?.email;
        return email || ipKeyGenerator(req as any);
      },
    });
  }

  /**
   * Moderate rate limiter for read operations
   */
  static read(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 200, // 200 read requests per minute
      message: {
        success: false,
        error: {
          message: "Too many read requests, please slow down.",
          code: "READ_RATE_LIMIT_EXCEEDED",
        },
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Strict rate limiter for write operations
   */
  static write(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 write requests per minute
      message: {
        success: false,
        error: {
          message: "Too many write requests, please try again later.",
          code: "WRITE_RATE_LIMIT_EXCEEDED",
        },
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Rate limiter for table operations (your specific use case)
   */
  static tables(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 table queries per minute
      message: {
        success: false,
        error: {
          message: "Too many table queries, please cache results.",
          code: "TABLE_RATE_LIMIT_EXCEEDED",
        },
        timestamp: new Date().toISOString(),
      },
      keyGenerator: (req: Request) => {
        return (req as any).user?.id || ipKeyGenerator(req as any);
      },
    });
  }

  /**
   * Distributed rate limiter using Redis
   */
  static distributed(options: RateLimiterConfig): RateLimitRequestHandler {
    if (!this.redisClient) {
      console.warn("Redis not configured, falling back to memory store");
      return rateLimit(options);
    }

    return rateLimit({
      ...options,
      store: new RedisStore({
        sendCommand: (command: string, ...args: string[]) =>
          this.redisClient!.call(command, ...args) as Promise<RedisReply>,
        prefix: "rl:",
      }),
    });
  }

  /**
   * Custom rate limiter with dynamic configuration
   */
  static custom(config: RateLimiterConfig): RateLimitRequestHandler {
    return rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      message: config.message || {
        success: false,
        error: {
          message: "Rate limit exceeded",
          code: "RATE_LIMIT_EXCEEDED",
        },
      },
      statusCode: config.statusCode || 429,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      keyGenerator:
        config.keyGenerator || ((req: Request) => ipKeyGenerator(req as any)),
      handler:
        config.handler ||
        ((req, res) => {
          res.status(config.statusCode || 429).json({
            success: false,
            error: {
              message:
                config.message || "Too many requests, please try again later.",
              code: "RATE_LIMIT_EXCEEDED",
              retryAfter: Math.ceil(config.windowMs / 1000),
            },
            timestamp: new Date().toISOString(),
          });
        }),
    });
  }
}

// Export simplified middleware functions
export const rateLimiterMiddleware = RateLimiterMiddleware.default();
export const authRateLimiter = RateLimiterMiddleware.auth();
export const readRateLimiter = RateLimiterMiddleware.read();
export const writeRateLimiter = RateLimiterMiddleware.write();
export const tablesRateLimiter = RateLimiterMiddleware.tables();

// Export class for advanced usage
export default RateLimiterMiddleware;
