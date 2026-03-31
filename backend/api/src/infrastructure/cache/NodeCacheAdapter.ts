import NodeCache from "node-cache";
import { ICacheProvider } from "../../core/interfaces/ICacheProvider";

export class NodeCacheAdapter implements ICacheProvider {
  private readonly cache: NodeCache;

  constructor(ttlSeconds: number = 300, checkPeriod: number = 120) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: checkPeriod,
      useClones: false,
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl: number): void {
    this.cache.set(key, value, ttl);
  }

  delete(key: string): void {
    this.cache.del(key);
  }

  clear(): void {
    this.cache.flushAll();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}
