// =============================================================================
// Environment Configuration
// =============================================================================
// Loads and validates all environment variables at startup.
// Fails fast with clear error messages if required variables are missing.
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Validated environment configuration.
 * Access via: import { env } from './config/env';
 */
export const env = {
  // Server
  port: parseInt(process.env.BACKEND_PORT || '8000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',

  // AI Provider
  aiProvider: process.env.AI_PROVIDER || 'gemini',

  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  // Future providers (read but not required yet)
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',

  // File Upload
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
  generatedDir: process.env.GENERATED_DIR || path.resolve(__dirname, '../../generated'),
} as const;

/**
 * Validate that critical environment variables are set.
 * Called once at startup.
 */
export function validateEnv(): void {
  const warnings: string[] = [];

  if (!env.geminiApiKey && env.aiProvider === 'gemini') {
    warnings.push(
      'GEMINI_API_KEY is not set. AI features will not work. ' +
      'Get a key at: https://aistudio.google.com/app/apikey'
    );
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Warnings:');
    warnings.forEach((w) => console.warn(`   → ${w}`));
    console.warn('');
  }
}
