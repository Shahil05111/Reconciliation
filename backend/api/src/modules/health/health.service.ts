import { injectable, inject } from "inversify";
import { ICacheService } from "../../core/interfaces/ICacheProvider";
import { TableRepository } from "../../infrastructure/database/repositories/TableRepository";
import { TYPES } from "../../shared/constants/types";
import { logger } from "../../infrastructure/logging/logger.services";

export interface IHealthService {
  getTables(correlationId: string): Promise<{ source: string; data: any[] }>;
  checkHealth(): Promise<HealthStatus>;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  database: "connected" | "disconnected";
  cache: "available" | "unavailable";
}

@injectable()
export class HealthService implements IHealthService {
  constructor(
    @inject(TYPES.TableRepository) private readonly tableRepo: TableRepository,
    @inject(TYPES.CacheService) private readonly cacheService: ICacheService,
  ) {}

  async getTables(
    correlationId: string,
  ): Promise<{ source: string; data: any[] }> {
    const cacheKey = "tables_list";

    const isCached = this.cacheService.has(cacheKey);

    const data = await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Fetching tables from database", { correlationId });
        return await this.tableRepo.getAllTables(correlationId);
      },
      300,
      correlationId,
    );

    return {
      source: isCached ? "cache" : "database",
      data,
    };
  }

  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.tableRepo.ping(),
      Promise.resolve(true),
    ]);

    const databaseConnected = checks[0].status === "fulfilled";

    let status: HealthStatus["status"] = "healthy";
    if (!databaseConnected) status = "unhealthy";

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: databaseConnected ? "connected" : "disconnected",
      cache: "available",
    };
  }
}
