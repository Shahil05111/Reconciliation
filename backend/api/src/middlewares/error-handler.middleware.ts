import { Request, Response, NextFunction } from "express";
import { BaseException } from "../core/exceptions/BaseException";
import { logger } from "../infrastructure/logging/logger.services";
import { v4 as uuidv4 } from "uuid";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const correlationId = (req as any).correlationId || uuidv4();

  logger.error("Request failed", {
    error: error.message,
    stack: error.stack,
    correlationId,
    path: req.path,
    method: req.method,
  });

  if (error instanceof BaseException) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.name,
        correlationId: error.correlationId || correlationId,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const message = isProduction ? "An unexpected error occurred" : error.message;

  return res.status(500).json({
    success: false,
    error: {
      message,
      correlationId,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};
