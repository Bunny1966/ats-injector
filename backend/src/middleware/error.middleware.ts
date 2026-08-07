// =============================================================================
// Global Error Handling Middleware
// =============================================================================
// Catches all unhandled errors and returns a consistent JSON response.
// Also includes a custom AppError class for business logic errors.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@resume-optimizer/shared';
import { logger } from '../utils/logger';

/**
 * Custom application error with HTTP status code and error code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Express error handling middleware.
 * Must be registered AFTER all routes.
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine status code and error code
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  const details = err instanceof AppError ? err.details : undefined;

  // Log the error
  logger.error(err.message, {
    code,
    statusCode,
    stack: err.stack,
    ...(details ? { details } : {}),
  });

  // Send consistent error response
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message: statusCode === 500 ? 'An internal server error occurred' : err.message,
      ...(details ? { details } : {}),
    },
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}

/**
 * Middleware to handle 404 (route not found).
 */
export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404, 'NOT_FOUND'));
}
