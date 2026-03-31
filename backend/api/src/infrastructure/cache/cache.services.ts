import { inject, injectable } from "inversify";
import {
  ICacheProvider,
  ICacheService,
} from "../../core/interfaces/ICacheProvider";
import { TYPES } from "../../shared/constants/types";

@injectable()
export class CacheService implements ICacheService {
  private readonly provider: ICacheProvider;
  private readonly defaultTtl: number;
  private readonly groups: Map<string, Set<string>> = new Map();

  constructor(
    @inject(TYPES.CacheProvider) provider: ICacheProvider,
    defaultTtl: number = 300,
  ) {
    this.provider = provider;
    this.defaultTtl = defaultTtl;
  }

  /**
   * Returns the cached value if present, otherwise calls `fetcher`,
   * caches the result and returns it.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTtl,
    group?: string,
  ): Promise<T> {
    const cached = this.provider.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    this.provider.set(key, value, ttl);

    if (group) {
      this.addToGroup(group, key);
    }

    return value;
  }

  /**
   * Read a value from the cache.
   */
  get<T>(key: string): T | undefined {
    return this.provider.get<T>(key);
  }

  /**
   * Write a value to the cache with an optional group tag for bulk invalidation.
   */
  set<T>(
    key: string,
    value: T,
    ttl: number = this.defaultTtl,
    group?: string,
  ): void {
    this.provider.set(key, value, ttl);

    if (group) {
      this.addToGroup(group, key);
    }
  }

  /**
   * Delete a single key.
   */
  delete(key: string): void {
    this.provider.delete(key);
    this.removeFromAllGroups(key);
  }

  /**
   * Alias for delete — satisfies the ICacheService contract.
   */
  invalidate(key: string): void {
    this.delete(key);
  }

  /**
   * Delete every key that belongs to the given group.
   */
  invalidateGroup(group: string): void {
    const keys = this.groups.get(group);
    if (!keys) return;

    for (const key of keys) {
      this.provider.delete(key);
    }

    this.groups.delete(group);
  }

  /**
   * Wipe the entire cache and reset all group bookkeeping.
   */
  clear(): void {
    this.provider.clear();
    this.groups.clear();
  }

  /**
   * Check whether a key exists in the cache.
   */
  has(key: string): boolean {
    return this.provider.has(key);
  }

  /**
   * Wrap a function so its result is automatically cached.
   * The cache key is built from the prefix and serialised arguments.
   *
   * Usage:
   *   const cachedFn = cacheService.wrap("getUser", (id: string) => db.findUser(id));
   *   await cachedFn("123");
   */
  wrap<TArgs extends unknown[], TReturn>(
    keyPrefix: string,
    fn: (...args: TArgs) => Promise<TReturn>,
    ttl: number = this.defaultTtl,
    group?: string,
  ): (...args: TArgs) => Promise<TReturn> {
    return (...args: TArgs) => {
      const key = `${keyPrefix}:${JSON.stringify(args)}`;
      return this.getOrSet(key, () => fn(...args), ttl, group);
    };
  }

  // ─── private helpers ────────────────────────────────────────────────────────

  private addToGroup(group: string, key: string): void {
    if (!this.groups.has(group)) {
      this.groups.set(group, new Set());
    }
    this.groups.get(group)!.add(key);
  }

  private removeFromAllGroups(key: string): void {
    for (const keys of this.groups.values()) {
      keys.delete(key);
    }
  }
}
