import { ConnectionPool } from "mssql";
import { getPool } from "../connection";
import { DatabaseException } from "../../../core/exceptions/BaseException";
import { logger } from "../../logging/logger.services";

export abstract class BaseRepository {
  protected abstract readonly tableName: string;

  protected async executeQuery<T>(
    query: string,
    correlationId?: string,
  ): Promise<T[]> {
    try {
      const pool: ConnectionPool = await getPool();
      const result = await pool.request().query(query);
      return result.recordset as T[];
    } catch (error) {
      logger.error("Database query failed", { error, query, correlationId });
      throw new DatabaseException(
        `Failed to execute query on ${this.tableName}`,
        correlationId,
        error,
      );
    }
  }

  protected async executeScalar<T>(
    query: string,
    correlationId?: string,
  ): Promise<T | null> {
    const results = await this.executeQuery<T>(query, correlationId);
    return results[0] || null;
  }
}
