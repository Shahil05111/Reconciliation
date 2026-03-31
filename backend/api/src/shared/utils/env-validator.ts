/**
 * Runtime environment variable validator
 * Validates presence and basic format of required env vars at startup.
 */

export interface EnvValidationError {
  variable: string;
  message: string;
}

export interface EnvValidationResult {
  valid: boolean;
  errors: EnvValidationError[];
}

const REQUIRED_VARS: Array<{ name: string; pattern?: RegExp; hint?: string }> =
  [
    { name: "DB_SERVER", hint: "e.g. localhost or 192.168.1.1" },
    { name: "DB_USER", hint: "Database username" },
    { name: "DB_PASSWORD", hint: "Database password" },
    { name: "DB_NAME", hint: "Database name" },
    {
      name: "NODE_ENV",
      pattern: /^(development|staging|production|test)$/,
      hint: "Must be development | staging | production | test",
    },
  ];

const OPTIONAL_VARS: Array<{ name: string; default: string }> = [
  { name: "PORT", default: "4000" },
  { name: "DB_PORT", default: "1433" },
  { name: "CACHE_TTL", default: "300" },
  { name: "ALLOWED_ORIGIN", default: "http://localhost:3000" },
  { name: "RATE_LIMIT_WINDOW", default: "60000" },
  { name: "RATE_LIMIT_MAX", default: "100" },
];

export function validateEnv(): EnvValidationResult {
  const errors: EnvValidationError[] = [];

  for (const { name, pattern, hint } of REQUIRED_VARS) {
    const value = process.env[name];

    if (!value || value.trim() === "") {
      errors.push({
        variable: name,
        message: `Missing required variable${hint ? ` — ${hint}` : ""}`,
      });
      continue;
    }

    if (pattern && !pattern.test(value)) {
      errors.push({
        variable: name,
        message: `Invalid value "${value}"${hint ? ` — ${hint}` : ""}`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates env and throws if any required variable is missing.
 * Call once at application bootstrap before anything else.
 */
export function assertEnv(): void {
  const result = validateEnv();

  if (!result.valid) {
    const lines = result.errors
      .map((e) => `  ❌ ${e.variable}: ${e.message}`)
      .join("\n");

    throw new Error(
      `Environment validation failed — fix the following:\n${lines}`,
    );
  }

  // Apply defaults for optional vars
  for (const { name, default: def } of OPTIONAL_VARS) {
    if (!process.env[name]) {
      process.env[name] = def;
    }
  }

  console.log("✅ Environment variables validated");
}
