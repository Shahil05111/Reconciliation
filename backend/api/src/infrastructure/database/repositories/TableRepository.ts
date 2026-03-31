import { injectable } from "inversify";
import { BaseRepository } from "./BaseRepository";
import { TableEntity } from "../../../core/entities/Table.entity";
import { pingDatabase } from "../connection";

@injectable()
export class TableRepository extends BaseRepository {
  protected readonly tableName = "sys.tables";

  /**
   * Returns all user-created tables in the database.
   */
  async getAllTables(correlationId?: string): Promise<TableEntity[]> {
    const query = `
SELECT
  t.name                          AS name,
  s.name                          AS [schema],
  t.type_desc                     AS type,
  t.create_date                   AS createDate,
  t.modify_date                   AS modifyDate
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
ORDER BY s.name, t.name
`;

    return this.executeQuery<TableEntity>(query, correlationId);
  }

  /**
   * Returns a single table by name and schema.
   */
  async findByName(
    tableName: string,
    schema = "dbo",
    correlationId?: string,
  ): Promise<TableEntity | null> {
    const query = `
      SELECT
        t.name        AS name,
        s.name        AS [schema],
        t.type_desc   AS type,
        t.create_date AS createDate,
        t.modify_date AS modifyDate
      FROM sys.tables t
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE t.name   = '${tableName.replace(/'/g, "''")}'
        AND s.name   = '${schema.replace(/'/g, "''")}'
    `;

    return this.executeScalar<TableEntity>(query, correlationId);
  }

  /**
   * Lightweight DB connectivity check used by the health service.
   */
  async ping(): Promise<boolean> {
    return pingDatabase();
  }
}
