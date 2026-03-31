import { config } from "./index";

export interface ServerConfig {
  port: number;
  env: string;
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  bodyLimit: string;
  shutdownTimeoutMs: number;
}

export const serverConfig: ServerConfig = {
  port: config.PORT,
  env: config.NODE_ENV,
  corsOrigin: config.ALLOWED_ORIGIN,
  rateLimitWindowMs: config.RATE_LIMIT_WINDOW,
  rateLimitMax: config.RATE_LIMIT_MAX,
  bodyLimit: "10kb",
  shutdownTimeoutMs: 30_000,
};
