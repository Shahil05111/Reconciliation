import "reflect-metadata";

import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";

import { container } from "./shared/container";

import { TYPES } from "./shared/constants/types";

import { HealthController } from "./modules/health/health.controller";
import { correlationIdMiddleware } from "./middlewares/correlation-id.middleware";

import { rateLimiterMiddleware } from "./middlewares/rate-limiter.middleware";
import { simpleRequestLogger } from "./infrastructure/logging/request-logger.middleware";

import { errorHandler } from "./middlewares/error-handler.middleware";
import { config } from "./config";

export class App {
  private readonly app: Application;
  private readonly healthController: HealthController;

  constructor() {
    this.app = express();
    this.healthController = container.get<HealthController>(
      TYPES.HealthController,
    );
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddlewares(): void {
    // Security & Performance
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(
      cors({
        origin: config.ALLOWED_ORIGIN,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
      }),
    );

    // Request parsing
    this.app.use(express.json({ limit: "10kb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10kb" }));

    // Observability
    this.app.use(correlationIdMiddleware);
    this.app.use(simpleRequestLogger);
    this.app.use(rateLimiterMiddleware);
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get(
      "/health",
      this.healthController.healthCheck.bind(this.healthController),
    );

    // Tables endpoint
    this.app.get(
      "/tables",
      this.healthController.getTables.bind(this.healthController),
    );

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          message: `Cannot ${req.method} ${req.path}`,
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public getApp(): Application {
    return this.app;
  }
}
