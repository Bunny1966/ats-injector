// =============================================================================
// Express Application Entry Point
// =============================================================================
// Bootstraps the Express server with all middleware and routes.
// =============================================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import { env, validateEnv } from './config/env';
import { API_PREFIX } from './config/constants';
import routes from './routes';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { ensureDirectories, startAutoCleanup } from './services/file.service';
import { logger } from './utils/logger';

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

// Validate environment variables
validateEnv();

// Ensure upload and generated directories exist
ensureDirectories();

// Start the background file cleanup cron job
startAutoCleanup();

// Create Express app
const app = express();

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------

// CORS — allow requests from the frontend
const allowedOrigins = [
  'http://localhost:3000',
  env.frontendUrl
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl or Postman)
      if (!origin) return callback(null, true);
      
      // Allow if it matches allowedOrigins OR if it's a Vercel preview URL
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, false); // Block other origins gracefully
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Parse JSON request bodies
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve generated files statically (for download)
app.use(
  '/generated',
  express.static(path.resolve(__dirname, '../generated'))
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Mount all API routes under /api
app.use(API_PREFIX, routes);

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

// 404 handler (must come after all routes)
app.use(notFoundMiddleware);

// Global error handler (must be last middleware)
app.use(errorMiddleware);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(env.port, () => {
  logger.info(`🚀 AI Resume Optimizer Backend running`, {
    port: env.port,
    env: env.nodeEnv,
    aiProvider: env.aiProvider,
    frontendUrl: env.frontendUrl,
  });
  logger.info(`📡 API available at http://localhost:${env.port}${API_PREFIX}`);
  logger.info(`❤️  Health check: http://localhost:${env.port}${API_PREFIX}/health`);
});

export default app;
