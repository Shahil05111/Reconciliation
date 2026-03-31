/**
 * Dependency Injection Token Types
 * Used with InversifyJS for IoC container
 *
 * @description Central registry of all DI tokens to avoid magic strings
 * @example
 * ```typescript
 * @injectable()
 * export class UserService {
 *   constructor(
 *     @inject(TYPES.UserRepository) private userRepo: UserRepository,
 *     @inject(TYPES.CacheService) private cache: ICacheService
 *   ) {}
 * }
 * ```
 */

export const TYPES = {
  // ========== CACHE SERVICES ==========
  /** Cache provider interface (NodeCacheAdapter, RedisAdapter, etc.) */
  CacheProvider: Symbol.for("CacheProvider"),

  /** Cache service for business logic (getOrSet, invalidate, etc.) */
  CacheService: Symbol.for("CacheService"),

  // ========== DATABASE & REPOSITORIES ==========
  /** Database connection pool */
  DatabasePool: Symbol.for("DatabasePool"),

  /** Base repository abstraction */
  BaseRepository: Symbol.for("BaseRepository"),

  /** Table metadata repository */
  TableRepository: Symbol.for("TableRepository"),

  /** User repository (if needed) */
  UserRepository: Symbol.for("UserRepository"),

  /** Product repository (if needed) */
  ProductRepository: Symbol.for("ProductRepository"),

  // ========== SERVICES (BUSINESS LOGIC) ==========
  /** Health check service */
  HealthService: Symbol.for("HealthService"),

  /** User service */
  UserService: Symbol.for("UserService"),

  /** Authentication service */
  AuthService: Symbol.for("AuthService"),

  /** Analytics service */
  AnalyticsService: Symbol.for("AnalyticsService"),

  // ========== CONTROLLERS (HTTP HANDLERS) ==========
  /** Health check controller */
  HealthController: Symbol.for("HealthController"),

  /** User controller */
  UserController: Symbol.for("UserController"),

  /** Authentication controller */
  AuthController: Symbol.for("AuthController"),

  /** Analytics controller */
  AnalyticsController: Symbol.for("AnalyticsController"),

  // ========== MIDDLEWARES ==========
  /** Authentication middleware */
  AuthMiddleware: Symbol.for("AuthMiddleware"),

  /** Validation middleware */
  ValidationMiddleware: Symbol.for("ValidationMiddleware"),

  /** Rate limiting middleware */
  RateLimiterMiddleware: Symbol.for("RateLimiterMiddleware"),

  // ========== UTILITIES ==========
  /** Logger service */
  Logger: Symbol.for("Logger"),

  /** Configuration service */
  Config: Symbol.for("Config"),

  /** Metrics collector */
  MetricsCollector: Symbol.for("MetricsCollector"),

  /** Event emitter / Event bus */
  EventBus: Symbol.for("EventBus"),

  // ========== FACTORIES ==========
  /** Repository factory for dynamic repository creation */
  RepositoryFactory: Symbol.for("RepositoryFactory"),

  /** Service factory for dynamic service creation */
  ServiceFactory: Symbol.for("ServiceFactory"),

  // ========== PROVIDERS ==========
  /** External API client provider */
  ApiClientProvider: Symbol.for("ApiClientProvider"),

  /** Queue provider (RabbitMQ, SQS, etc.) */
  QueueProvider: Symbol.for("QueueProvider"),

  /** Storage provider (S3, local, etc.) */
  StorageProvider: Symbol.for("StorageProvider"),
} as const;

/**
 * Type helper for extracting token values
 */
export type TYPES_TYPE = (typeof TYPES)[keyof typeof TYPES];

/**
 * Utility function to get token name from symbol for debugging
 */
export function getTokenName(token: symbol): string {
  const symbolString = token.toString();
  const match = symbolString.match(/Symbol\((.*?)\)/);
  return match ? match[1] : "UnknownToken";
}

/**
 * Validation helper to ensure all required dependencies are registered
 */
export const REQUIRED_TOKENS = [
  TYPES.CacheProvider,
  TYPES.CacheService,
  TYPES.TableRepository,
  TYPES.HealthService,
  TYPES.HealthController,
  TYPES.Logger,
] as const;

/**
 * Environment-specific token configuration
 */
export const ENVIRONMENT_TOKENS = {
  development: {
    DebugService: Symbol.for("DebugService"),
    MockDataProvider: Symbol.for("MockDataProvider"),
  },
  staging: {
    StagingValidator: Symbol.for("StagingValidator"),
  },
  production: {
    ProductionMonitor: Symbol.for("ProductionMonitor"),
    AuditService: Symbol.for("AuditService"),
  },
} as const;

/**
 * Feature flag tokens for conditional DI
 */
export const FEATURE_TOKENS = {
  Caching: Symbol.for("Feature:Caching"),
  RateLimiting: Symbol.for("Feature:RateLimiting"),
  Analytics: Symbol.for("Feature:Analytics"),
  FileUpload: Symbol.for("Feature:FileUpload"),
  WebSocket: Symbol.for("Feature:WebSocket"),
  GraphQL: Symbol.for("Feature:GraphQL"),
} as const;
