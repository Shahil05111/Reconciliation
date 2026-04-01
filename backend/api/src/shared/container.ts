import "reflect-metadata";
import { Container } from "inversify";
import { TYPES } from "./constants/types";
import { Logger } from "../infrastructure/logging/logger.services";
import { NodeCacheAdapter } from "../infrastructure/cache/NodeCacheAdapter";
import { CacheService } from "../infrastructure/cache/cache.services";
import { TableRepository } from "../infrastructure/database/repositories/TableRepository";
import { ReconciliationRepository } from "../infrastructure/database/repositories/ReconcilliatoinRepository";
import { HealthService } from "../modules/health/health.service";
import { HealthController } from "../modules/health/health.controller";
import { ReconciliationService } from "../modules/reconcilliation/reconciliation.service";
import { ReconciliationController } from "../modules/reconcilliation/reconciliation.controller";

import {
  ICacheProvider,
  ICacheService,
} from "../core/interfaces/ICacheProvider";
import { IHealthService } from "../modules/health/health.service";
import { IReconciliationService } from "../modules/reconcilliation/reconciliation.service";

const container = new Container();

// 1. Logger
container.bind<Logger>(TYPES.Logger).to(Logger).inSingletonScope();

// 2. Cache provider (no dependencies)
container
  .bind<ICacheProvider>(TYPES.CacheProvider)
  .to(NodeCacheAdapter)
  .inSingletonScope();

// 3. Cache service (depends on CacheProvider)
container
  .bind<ICacheService>(TYPES.CacheService)
  .to(CacheService)
  .inSingletonScope();

// 4. Table repository (depends on DB pool via getPool())
container
  .bind<TableRepository>(TYPES.TableRepository)
  .to(TableRepository)
  .inSingletonScope();

// 5. Reconciliation repository — read-only, authorize view mode
container
  .bind<ReconciliationRepository>(TYPES.ReconciliationRepository)
  .to(ReconciliationRepository)
  .inSingletonScope();

// 6. Health service (depends on TableRepository + CacheService)
container
  .bind<IHealthService>(TYPES.HealthService)
  .to(HealthService)
  .inSingletonScope();

// 7. Reconciliation service (depends on ReconciliationRepository + CacheService)
container
  .bind<IReconciliationService>(TYPES.ReconciliationService)
  .to(ReconciliationService)
  .inSingletonScope();

// 8. Health controller (depends on HealthService + Logger)
container
  .bind<HealthController>(TYPES.HealthController)
  .to(HealthController)
  .inTransientScope();

// 9. Reconciliation controller (depends on ReconciliationService + Logger)
container
  .bind<ReconciliationController>(TYPES.ReconciliationController)
  .to(ReconciliationController)
  .inTransientScope();

export { container };
