/**
 * Generic repository interface
 * All repositories must implement this contract
 */
export interface IRepository<T, TId = string> {
  findById(id: TId, correlationId?: string): Promise<T | null>;
  findAll(correlationId?: string): Promise<T[]>;
  create(entity: Omit<T, "id">, correlationId?: string): Promise<T>;
  update(
    id: TId,
    entity: Partial<T>,
    correlationId?: string,
  ): Promise<T | null>;
  delete(id: TId, correlationId?: string): Promise<boolean>;
  exists(id: TId, correlationId?: string): Promise<boolean>;
}

/**
 * Read-only repository variant for query-only repositories
 */
export interface IReadOnlyRepository<T, TId = string> {
  findById(id: TId, correlationId?: string): Promise<T | null>;
  findAll(correlationId?: string): Promise<T[]>;
  exists(id: TId, correlationId?: string): Promise<boolean>;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
}
