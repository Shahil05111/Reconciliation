import { config } from "./index";

export interface CacheConfig {
  ttl: number;
  checkPeriod: number;
  maxKeys: number;
}

export const cacheConfig: CacheConfig = {
  /** Default TTL in seconds — pulled from CACHE_TTL env var */
  ttl: config.CACHE_TTL,

  /** How often (seconds) the cache scans for expired keys */
  checkPeriod: 120,

  /** Max number of keys before oldest are evicted (-1 = unlimited) */
  maxKeys: -1,
};
