/**
 * Represents a database table record from sys.tables / INFORMATION_SCHEMA
 */
export interface TableEntity {
  name: string;
  schema: string;
  type: string;
  createDate: Date;
  modifyDate: Date;
  rowCount?: number;
}

/**
 * Lightweight version returned by health/tables endpoint
 */
export interface TableSummary {
  name: string;
  schema: string;
  rowCount?: number;
}
