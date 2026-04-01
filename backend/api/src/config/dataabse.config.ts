import { config } from "./index";
import { config as SqlConfig } from "mssql";

export const databaseConfig: SqlConfig = {
  server: config.DB_SERVER,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  port: config.DB_PORT,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30_000,
  },
  // Raised from 15s → 120s.
  // Cross-database JOINs on tables with 10M–20M rows (b2c_non_split,
  // b2c_detail, myntra_seller_order) require more time, especially when
  // no covering indexes exist on the filter/join columns.
  // Export queries fetch up to 500 rows with date filters applied —
  // these are the most expensive and need the most headroom.
  requestTimeout: 120_000,
  connectionTimeout: 30_000,
};