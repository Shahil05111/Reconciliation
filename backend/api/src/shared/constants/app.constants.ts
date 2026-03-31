/**
 * Application-wide constants
 * No business logic, just static values
 */

export const APP_CONSTANTS = {
  // Application metadata
  APP_NAME: "Enterprise API",
  APP_VERSION: process.env.npm_package_version || "1.0.0",

  // API configuration
  API_PREFIX: "/api/v1",
  API_DOCS_PATH: "/api/docs",

  // Time constants (in seconds)
  TIME: {
    SECOND: 1,
    MINUTE: 60,
    HOUR: 3600,
    DAY: 86400,
    WEEK: 604800,
  },

  // Cache TTL presets (in seconds)
  CACHE_TTL: {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 1800, // 30 minutes
    VERY_LONG: 7200, // 2 hours
    DAY: 86400, // 24 hours
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  // Rate limiting defaults
  RATE_LIMIT: {
    WINDOW_MS: 60000, // 1 minute
    MAX_REQUESTS: 100,
    SKIP_SUCCESSFUL_REQUESTS: false,
  },

  // Request limits
  REQUEST: {
    MAX_BODY_SIZE: "10kb",
    MAX_URL_LENGTH: 2048,
    TIMEOUT_MS: 30000,
  },

  // Security headers
  SECURITY: {
    CORS_ALLOWED_METHODS: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    CORS_ALLOWED_HEADERS: [
      "Content-Type",
      "Authorization",
      "X-Correlation-ID",
      "X-Request-ID",
    ],
    CORS_EXPOSED_HEADERS: [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-Request-ID",
    ],
  },

  // Logging
  LOGGING: {
    DEFAULT_LEVEL: process.env.LOG_LEVEL || "info",
    FILE_PATH: "logs/app.log",
    MAX_SIZE: "20m",
    MAX_FILES: "14d",
  },

  // Health check
  HEALTH: {
    READINESS_CHECK_INTERVAL: 5000, // 5 seconds
    LIVENESS_CHECK_INTERVAL: 10000, // 10 seconds
    SHUTDOWN_TIMEOUT_MS: 30000, // 30 seconds
  },
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Error codes for business logic
export const ERROR_CODES = {
  // Authentication errors (1000-1099)
  AUTH_001: "AUTH_001", // Invalid credentials
  AUTH_002: "AUTH_002", // Token expired
  AUTH_003: "AUTH_003", // Insufficient permissions

  // Validation errors (1100-1199)
  VALIDATION_001: "VALIDATION_001", // Required field missing
  VALIDATION_002: "VALIDATION_002", // Invalid format
  VALIDATION_003: "VALIDATION_003", // Value out of range

  // Database errors (1200-1299)
  DB_001: "DB_001", // Connection failed
  DB_002: "DB_002", // Query timeout
  DB_003: "DB_003", // Constraint violation

  // Business logic errors (1300-1399)
  BUSINESS_001: "BUSINESS_001", // Resource not found
  BUSINESS_002: "BUSINESS_002", // Duplicate resource
  BUSINESS_003: "BUSINESS_003", // Operation not allowed
} as const;

// Environment names
export const ENVIRONMENTS = {
  DEVELOPMENT: "development",
  STAGING: "staging",
  PRODUCTION: "production",
  TEST: "test",
} as const;

// Regular expressions for validation
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
} as const;
