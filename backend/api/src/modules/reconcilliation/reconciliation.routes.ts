import { Router } from "express";
import { container } from "../../shared/container";
import { TYPES } from "../../shared/constants/types";

import { ReconciliationController } from "./reconciliation.controller";

import { readRateLimiter } from "../../middlewares/rate-limiter.middleware";

import {
  validateReconFilters,
  validateReconSummary,
  validateReconExport,
} from "./reconciliation.validators";

const router = Router();

const ctrl = container.get<ReconciliationController>(
  TYPES.ReconciliationController,
);

/**
 * GET /reconciliation/summary
 * Aggregated counts across all 3 reconciliation views.
 * No pagination — summary only.
 * Cache TTL: 5 minutes.
 *
 * Query params: dateFrom, dateTo, brand, salesChannel, warehouseName
 */
router.get(
  "/reconciliation/summary",
  readRateLimiter,
  validateReconSummary,
  ctrl.getSummary.bind(ctrl),
);

/**
 * GET /reconciliation/oms-vs-dispatch
 * Recon A: lib_backup.dbo.b2c_non_split vs dbo.b2c_detail
 * Identifies orders in OMS that were never dispatched from WMS,
 * or where dispatched_quantity != ordered_quantity.
 * Cache TTL: 1 minute.
 *
 * Query params: dateFrom, dateTo, brand, salesChannel, warehouseName, page, limit
 */
router.get(
  "/reconciliation/oms-vs-dispatch",
  readRateLimiter,
  validateReconFilters,
  ctrl.getOmsVsDispatch.bind(ctrl),
);

/**
 * GET /reconciliation/order-vs-settlement
 * Recon B: dbo.myntra_seller_oder vs dbo.myntra_f_settelment
 * Identifies delivered Myntra orders with missing or partial
 * forward settlements (amount_pending_settlement > 0).
 * Cache TTL: 1 minute.
 *
 * Query params: dateFrom, dateTo, brand, page, limit
 */
router.get(
  "/reconciliation/order-vs-settlement",
  readRateLimiter,
  validateReconFilters,
  ctrl.getOrderVsSettlement.bind(ctrl),
);

/**
 * GET /reconciliation/return-vs-settlement
 * Recon C: dbo.return_order_report_item_level_wms
 *            vs dbo.myntra_rt
 *            vs dbo.myntra_r_settelment
 * Identifies physically received WMS returns that are missing
 * from Myntra's return tracker or have no financial settlement.
 * Cache TTL: 1 minute.
 *
 * Query params: dateFrom, dateTo, brand, salesChannel, warehouseName, page, limit
 */
router.get(
  "/reconciliation/return-vs-settlement",
  readRateLimiter,
  validateReconFilters,
  ctrl.getReturnVsSettlement.bind(ctrl),
);

/**
 * GET /reconciliation/mismatches
 * All gap rows across all 3 views in a single response.
 * Useful for dashboards showing a combined mismatch count/badge.
 * Cache TTL: 1 minute.
 *
 * Query params: dateFrom, dateTo, brand, salesChannel, warehouseName, page, limit
 */
router.get(
  "/reconciliation/mismatches",
  readRateLimiter,
  validateReconFilters,
  ctrl.getMismatches.bind(ctrl),
);

/**
 * GET /reconciliation/export
 * CSV download for any of the 3 reconciliation views.
 * Max 500 rows per export. Returns text/csv with Content-Disposition.
 * No cache — always fetches fresh from DB.
 *
 * Query params: view (required), dateFrom, dateTo, brand, salesChannel, warehouseName
 */
router.get(
  "/reconciliation/export",
  readRateLimiter,
  validateReconExport,
  ctrl.exportCsv.bind(ctrl),
);

export default router;
