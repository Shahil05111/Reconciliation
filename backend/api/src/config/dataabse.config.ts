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
  requestTimeout: 15_000,
  connectionTimeout: 30_000,
};
