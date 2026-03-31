/**
 * Generic service interface
 * All business logic services should implement this contract
 */
export interface IService<T, TId = string> {
  findById(id: TId, correlationId?: string): Promise<T | null>;
  findAll(correlationId?: string): Promise<T[]>;
  create(data: Omit<T, "id">, correlationId?: string): Promise<T>;
  update(id: TId, data: Partial<T>, correlationId?: string): Promise<T | null>;
  delete(id: TId, correlationId?: string): Promise<boolean>;
}

/**
 * Service operation result wrapper
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId?: string;
}
