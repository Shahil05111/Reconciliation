import { injectable, inject } from "inversify";
import { Request, Response } from "express";
import { TYPES } from "../../shared/constants/types";
import { IHealthService } from "./health.service";
import { Logger } from "../../infrastructure/logging/logger.services";

@injectable()
export class HealthController {
  constructor(
    @inject(TYPES.HealthService) private readonly healthService: IHealthService,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {}

  async healthCheck(req: Request, res: Response): Promise<void> {
    const correlationId = (req as any).correlationId;

    this.logger.info("Health check requested", { correlationId });

    const health = await this.healthService.checkHealth();

    res.status(200).json({
      success: true,
      data: health,
    });
  }

  async getTables(req: Request, res: Response): Promise<void> {
    const correlationId = (req as any).correlationId;

    const result = await this.healthService.getTables(correlationId);

    res.json({
      success: true,
      data: result.data,
      meta: {
        source: result.source,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
