// =============================================================================
// Route Aggregator
// =============================================================================
// Mounts all route modules under the API prefix.
// New feature routes are added here.
// =============================================================================

import { Router } from 'express';
import healthRoutes from './health.routes';
import resumeRoutes from './resume.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/resume', resumeRoutes);

export default router;
