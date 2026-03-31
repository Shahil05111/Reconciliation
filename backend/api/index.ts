import { App } from "./src/app";

import { getPool, closePool } from "./src/infrastructure/database/connection";
import { logger } from "./src/infrastructure/logging/logger.services";
import { config } from "./src/config/index";
import { Application } from "express";

class Server {
  private readonly app: Application;
  private server: any;

  constructor() {
    this.app = new App().getApp();
  }

  async start(): Promise<void> {
    try {
      await getPool();

      logger.info("Database connection established");

      this.server = this.app.listen(config.PORT, () => {
        logger.info(`Server started successfully`, {
          port: config.PORT,
          environment: config.NODE_ENV,
          healthCheck: `http://localhost:${config.PORT}/health`,
        });
      });

      this.setupGracefulShutdown();
    } catch (error) {
      logger.error("Failed to start server", { error });
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      const timeout = setTimeout(() => {
        logger.error("Graceful shutdown timed out, forcing exit");
        process.exit(1);
      }, 30000);

      try {
        await new Promise<void>((resolve) => {
          this.server.close(() => resolve());
        });
        logger.info("HTTP server closed");

        await closePool();
        logger.info("Database connections closed");

        clearTimeout(timeout);
        logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logger.error("Error during graceful shutdown", { error });
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}

const server = new Server();

server.start().catch((error) => {
  logger.error("Unhandled startup error", { error });
  process.exit(1);
});
