export interface ICacheProvider {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

export interface ICacheService {
  getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    correlationId?: string,
  ): Promise<T>;
  invalidate(keys: string | string[]): void;
  has(key: string): boolean;
}
