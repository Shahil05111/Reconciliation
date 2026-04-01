import sql, { type config as SqlConfig, ConnectionPool } from "mssql";
import { databaseConfig } from "../../config/dataabse.config";

let pool: ConnectionPool | null = null;

export async function getPool(): Promise<ConnectionPool> {
  try {
    if (pool && pool.connected) {
      return pool;
    }

    pool = await sql.connect(databaseConfig);
    console.log("✅ DB connected");

    return pool;
  } catch (error) {
    console.error("❌ DB connection failed:", error);
    throw error;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export async function pingDatabase(): Promise<boolean> {
  try {
    const p = await getPool();
    await p.request().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
