import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  PORT: z.string().transform(Number).default(4000),

  DB_SERVER: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_PORT: z.string().transform(Number).default(1433),

  REDIS_URL: z.string().optional(),
  CACHE_TTL: z.string().transform(Number).default(300),

  ALLOWED_ORIGIN: z.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default(60000),
  RATE_LIMIT_MAX: z.string().transform(Number).default(100),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
