import { injectable, inject } from "inversify";
import { Request, Response, NextFunction } from "express";
import { TYPES } from "../../shared/constants/types";
import { IReconciliationService } from "./reconciliation.service";
import { Logger } from "../../infrastructure/logging/logger.services";
import { ResponseFormatter } from "../../shared/utils/response-formatter";
import { HTTP_STATUS } from "../../shared/constants/app.constants";
import { ReconciliationFilters } from "../../core/entities/Reconciliation.entity";
import { ReconExportInput } from "./reconciliation.validators";

@injectable()
export class ReconciliationController {
  constructor(
    @inject(TYPES.ReconciliationService)
    private readonly reconService: IReconciliationService,

    @inject(TYPES.Logger)
    private readonly logger: Logger,
  ) {}

  // ─────────────────────────────────────────────────────────
  // GET /reconciliation/summary
  // Aggregated counts across all 3 reconciliation views.
  // ─────────────────────────────────────────────────────────

  async getSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const correlationId = (req as any).correlationId;

    try {
      const filters = res.locals.validatedQuery as ReconciliationFilters;

      this.logger.info("GET /reconciliation/summary", {
        correlationId,
        filters,
      });

      const { data, source } = await this.reconService.getSummary(
        filters,
        correlationId,
      );

      res.status(HTTP_STATUS.OK).json(
        ResponseFormatter.success(data, {
          source,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // GET /reconciliation/oms-vs-dispatch
  // Recon A — OMS order vs WMS dispatch, paginated.
  // ─────────────────────────────────────────────────────────

  async getOmsVsDispatch(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const correlationId = (req as any).correlationId;

    try {
      const filters = res.locals.validatedQuery as ReconciliationFilters;

      this.logger.info("GET /reconciliation/oms-vs-dispatch", {
        correlationId,
        filters,
      });

      const result = await this.reconService.getOmsVsDispatch(
        filters,
        correlationId,
      );

      res
        .status(HTTP_STATUS.OK)
        .json(
          ResponseFormatter.paginated(
            result.data,
            result.total,
            result.page,
            result.limit,
          ),
        );
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // GET /reconciliation/order-vs-settlement
  // Recon B — Myntra order vs forward settlement, paginated.
  // ─────────────────────────────────────────────────────────

  async getOrderVsSettlement(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const correlationId = (req as any).correlationId;

    try {
      const filters = res.locals.validatedQuery as ReconciliationFilters;

      this.logger.info("GET /reconciliation/order-vs-settlement", {
        correlationId,
        filters,
      });

      const result = await this.reconService.getOrderVsSettlement(
        filters,
        correlationId,
      );

      res
        .status(HTTP_STATUS.OK)
        .json(
          ResponseFormatter.paginated(
            result.data,
            result.total,
            result.page,
            result.limit,
          ),
        );
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // GET /reconciliation/return-vs-settlement
  // Recon C — WMS return receipt vs Myntra return settlement.
  // ─────────────────────────────────────────────────────────

  async getReturnVsSettlement(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const correlationId = (req as any).correlationId;

    try {
      const filters = res.locals.validatedQuery as ReconciliationFilters;

      this.logger.info("GET /reconciliation/return-vs-settlement", {
        correlationId,
        filters,
      });

      const result = await this.reconService.getReturnVsSettlement(
        filters,
        correlationId,
      );

      res
        .status(HTTP_STATUS.OK)
        .json(
          ResponseFormatter.paginated(
            result.data,
            result.total,
            result.page,
            result.limit,
          ),
        );
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // GET /reconciliation/mismatches
  // All gap rows across all 3 views in one response.
  // ─────────────────────────────────────────────────────────

  async getMismatches(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const correlationId = (req as any).correlationId;

    try {
      const filters = res.locals.validatedQuery as ReconciliationFilters;

      this.logger.info("GET /reconciliation/mismatches", {
        correlationId,
        filters,
      });

      const result = await this.reconService.getMismatches(
        filters,
        correlationId,
      );

      res.status(HTTP_STATUS.OK).json(
        ResponseFormatter.success(
          {
            omsGaps: result.omsGaps,
            settlementGaps: result.settlementGaps,
            returnGaps: result.returnGaps,
          },
          {
            totalGaps: result.totalGaps,
            source: result.source,
            timestamp: new Date().toISOString(),
          },
        ),
      );
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // GET /reconciliation/export
  // CSV download for any of the 3 views.
  // Sets Content-Disposition so browser triggers file download.
  // ─────────────────────────────────────────────────────────

  async exportCsv(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const correlationId = (req as any).correlationId;

    try {
      const { view, ...filters } = res.locals
        .validatedQuery as ReconExportInput;

      this.logger.info("GET /reconciliation/export", {
        correlationId,
        view,
        filters,
      });

      const csv = await this.reconService.exportToCsv(
        view,
        filters as ReconciliationFilters,
        correlationId,
      );

      const filename = `recon_${view}_${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("X-Correlation-ID", correlationId ?? "");

      res.status(HTTP_STATUS.OK).send(csv);
    } catch (err) {
      next(err);
    }
  }
}
