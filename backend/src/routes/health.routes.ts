// =============================================================================
// Health Check Routes
// =============================================================================

import { Router, Request, Response } from 'express';
import type { ApiResponse } from '@resume-optimizer/shared';

const router = Router();

/**
 * GET /api/health
 * Basic health check endpoint.
 */
router.get('/', (_req: Request, res: Response) => {
  const response: ApiResponse<{ status: string; uptime: number }> = {
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
    },
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
