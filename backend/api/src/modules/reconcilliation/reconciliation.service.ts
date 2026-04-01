import { injectable, inject } from "inversify";
import { TYPES } from "../../shared/constants/types";
import { ICacheService } from "../../core/interfaces/ICacheProvider";
import { ReconciliationRepository } from "../../infrastructure/database/repositories/ReconcilliatoinRepository";
import { logger } from "../../infrastructure/logging/logger.services";
import { APP_CONSTANTS } from "../../shared/constants/app.constants";
import {
  ReconciliationFilters,
  ReconciliationSummary,
  OmsVsDispatchRow,
  OrderVsSettlementRow,
  ReturnVsSettlementRow,
  PaginatedReconResult,
} from "../../core/entities/Reconciliation.entity";

// ─────────────────────────────────────────────────────────────
// Service interface — what the controller sees
// ─────────────────────────────────────────────────────────────

export interface IReconciliationService {
  getSummary(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<{ source: "cache" | "database"; data: ReconciliationSummary }>;

  getOmsVsDispatch(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<PaginatedReconResult<OmsVsDispatchRow>>;

  getOrderVsSettlement(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<PaginatedReconResult<OrderVsSettlementRow>>;

  getReturnVsSettlement(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<PaginatedReconResult<ReturnVsSettlementRow>>;

  getMismatches(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<{
    source: "cache" | "database";
    omsGaps: OmsVsDispatchRow[];
    settlementGaps: OrderVsSettlementRow[];
    returnGaps: ReturnVsSettlementRow[];
    totalGaps: number;
  }>;

  exportToCsv(
    view: "oms-vs-dispatch" | "order-vs-settlement" | "return-vs-settlement",
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<string>;
}

// ─────────────────────────────────────────────────────────────
// Cache TTL constants
// ─────────────────────────────────────────────────────────────

const TTL = {
  SUMMARY: APP_CONSTANTS.CACHE_TTL.MEDIUM,    // 5 min — aggregates change slowly
  PAGINATED: APP_CONSTANTS.CACHE_TTL.SHORT,   // 1 min — row-level data
  MISMATCHES: APP_CONSTANTS.CACHE_TTL.SHORT,  // 1 min
} as const;

const CACHE_GROUP = "reconciliation";

// ─────────────────────────────────────────────────────────────
// Cache key builder
// Encodes every active filter into a deterministic string so that
// different filter combinations never collide in the cache.
// ─────────────────────────────────────────────────────────────

function buildCacheKey(prefix: string, filters: ReconciliationFilters): string {
  const parts = [
    prefix,
    filters.dateFrom ?? "noFrom",
    filters.dateTo ?? "noTo",
    filters.brand ?? "noBrand",
    filters.salesChannel ?? "noCh",
    filters.warehouseName ?? "noWh",
    `p${filters.page ?? 1}`,
    `l${filters.limit ?? 50}`,
  ];
  return parts.join(":");
}

// ─────────────────────────────────────────────────────────────
// CSV serialisation helpers
// ─────────────────────────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h])).join(","),
  );
  return [headerLine, ...dataLines].join("\n");
}

// ─────────────────────────────────────────────────────────────
// Service implementation
// ─────────────────────────────────────────────────────────────

@injectable()
export class ReconciliationService implements IReconciliationService {
  constructor(
    @inject(TYPES.ReconciliationRepository)
    private readonly repo: ReconciliationRepository,

    @inject(TYPES.CacheService)
    private readonly cache: ICacheService,
  ) {}

  // ── Summary ───────────────────────────────────────────────

  async getSummary(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<{ source: "cache" | "database"; data: ReconciliationSummary }> {
    const key = buildCacheKey("recon:summary", filters);
    const wasCached = this.cache.has(key);

    logger.info("getSummary called", { correlationId, filters, wasCached });

    const data = await this.cache.getOrSet(
      key,
      () => this.repo.getSummary(filters, correlationId),
      TTL.SUMMARY,
      CACHE_GROUP,
    );

    return { source: wasCached ? "cache" : "database", data };
  }

  // ── Recon A — OMS vs Dispatch ─────────────────────────────

  async getOmsVsDispatch(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<PaginatedReconResult<OmsVsDispatchRow>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const key = buildCacheKey("recon:oms", filters);
    const wasCached = this.cache.has(key);

    logger.info("getOmsVsDispatch called", { correlationId, filters });

    const [data, total] = await Promise.all([
      this.cache.getOrSet(
        key,
        () => this.repo.getOmsVsDispatch(filters, correlationId),
        TTL.PAGINATED,
        CACHE_GROUP,
      ),
      this.cache.getOrSet(
        key + ":count",
        () => this.repo.countOmsVsDispatch(filters, correlationId),
        TTL.PAGINATED,
        CACHE_GROUP,
      ),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: wasCached ? "cache" : "database",
    };
  }

  // ── Recon B — Order vs Settlement ─────────────────────────

  async getOrderVsSettlement(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<PaginatedReconResult<OrderVsSettlementRow>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const key = buildCacheKey("recon:settlement", filters);
    const wasCached = this.cache.has(key);

    logger.info("getOrderVsSettlement called", { correlationId, filters });

    const [data, total] = await Promise.all([
      this.cache.getOrSet(
        key,
        () => this.repo.getOrderVsSettlement(filters, correlationId),
        TTL.PAGINATED,
        CACHE_GROUP,
      ),
      this.cache.getOrSet(
        key + ":count",
        () => this.repo.countOrderVsSettlement(filters, correlationId),
        TTL.PAGINATED,
        CACHE_GROUP,
      ),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: wasCached ? "cache" : "database",
    };
  }

  // ── Recon C — Return vs Settlement ────────────────────────

  async getReturnVsSettlement(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<PaginatedReconResult<ReturnVsSettlementRow>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const key = buildCacheKey("recon:returns", filters);
    const wasCached = this.cache.has(key);

    logger.info("getReturnVsSettlement called", { correlationId, filters });

    const [data, total] = await Promise.all([
      this.cache.getOrSet(
        key,
        () => this.repo.getReturnVsSettlement(filters, correlationId),
        TTL.PAGINATED,
        CACHE_GROUP,
      ),
      this.cache.getOrSet(
        key + ":count",
        () => this.repo.countReturnVsSettlement(filters, correlationId),
        TTL.PAGINATED,
        CACHE_GROUP,
      ),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: wasCached ? "cache" : "database",
    };
  }

  // ── Mismatches — gap rows across all 3 views ──────────────

  async getMismatches(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<{
    source: "cache" | "database";
    omsGaps: OmsVsDispatchRow[];
    settlementGaps: OrderVsSettlementRow[];
    returnGaps: ReturnVsSettlementRow[];
    totalGaps: number;
  }> {
    const key = buildCacheKey("recon:mismatches", filters);
    const wasCached = this.cache.has(key);

    logger.info("getMismatches called", { correlationId, filters });

    type MismatchPayload = {
      omsGaps: OmsVsDispatchRow[];
      settlementGaps: OrderVsSettlementRow[];
      returnGaps: ReturnVsSettlementRow[];
      totalGaps: number;
    };

    const payload = await this.cache.getOrSet<MismatchPayload>(
      key,
      async () => {
        const [omsGaps, settlementGaps, returnGaps] = await Promise.all([
          this.repo.getMismatchedOmsRows(filters, correlationId),
          this.repo.getMismatchedSettlementRows(filters, correlationId),
          this.repo.getMismatchedReturnRows(filters, correlationId),
        ]);

        return {
          omsGaps,
          settlementGaps,
          returnGaps,
          totalGaps: omsGaps.length + settlementGaps.length + returnGaps.length,
        };
      },
      TTL.MISMATCHES,
      CACHE_GROUP,
    );

    return { source: wasCached ? "cache" : "database", ...payload };
  }

  // ── CSV Export ────────────────────────────────────────────
  //
  // Export goes directly to the repository — bypassing the cache and
  // the COUNT query that the paginated service methods run in parallel.
  // This halves the number of DB round-trips for export and avoids
  // returning a stale cached slice instead of a fresh date-filtered set.
  //
  // limit is capped at 500 rows (enforced inside the repository).

  async exportToCsv(
    view: "oms-vs-dispatch" | "order-vs-settlement" | "return-vs-settlement",
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<string> {
    const exportFilters: ReconciliationFilters = {
      ...filters,
      page: 1,
      limit: 500,
    };

    logger.info("exportToCsv called", { correlationId, view, filters });

    switch (view) {
      case "oms-vs-dispatch": {
        // Call repo directly — no cache, no COUNT query
        const rows = await this.repo.getOmsVsDispatch(
          exportFilters,
          correlationId,
        );
        return rowsToCsv(rows as unknown as Record<string, unknown>[]);
      }

      case "order-vs-settlement": {
        const rows = await this.repo.getOrderVsSettlement(
          exportFilters,
          correlationId,
        );
        return rowsToCsv(rows as unknown as Record<string, unknown>[]);
      }

      case "return-vs-settlement": {
        const rows = await this.repo.getReturnVsSettlement(
          exportFilters,
          correlationId,
        );
        return rowsToCsv(rows as unknown as Record<string, unknown>[]);
      }

      default: {
        const _exhaustive: never = view;
        throw new Error(`Unknown export view: ${_exhaustive}`);
      }
    }
  }
}