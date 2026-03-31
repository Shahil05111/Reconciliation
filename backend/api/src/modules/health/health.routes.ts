import { Router } from "express";
import { container } from "../../shared/container";
import { TYPES } from "../../shared/constants/types";
import { HealthController } from "./health.controller";
import { tablesRateLimiter } from "../../middlewares/rate-limiter.middleware";

const router = Router();

const ctrl = container.get<HealthController>(TYPES.HealthController);

/**
 * GET /health
 * Basic liveness + readiness check
 */
router.get("/health", ctrl.healthCheck.bind(ctrl));

/**
 * GET /health/tables
 * Returns all DB tables (cached)
 */
router.get("/health/tables", tablesRateLimiter, ctrl.getTables.bind(ctrl));

export default router;
