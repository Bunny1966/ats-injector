// =============================================================================
// Validation Middleware
// =============================================================================
// Generic request body validation using Zod schemas.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './error.middleware';

/**
 * Creates a middleware that validates the request body against a Zod schema.
 * On validation failure, throws an AppError with details about what went wrong.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        next(
          new AppError(
            'Validation failed',
            400,
            'VALIDATION_ERROR',
            details
          )
        );
      } else {
        next(error);
      }
    }
  };
}
