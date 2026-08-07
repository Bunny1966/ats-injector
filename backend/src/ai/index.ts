// =============================================================================
// AI Service — Provider Management
// =============================================================================
// Factory that creates the correct AI provider based on environment config.
// All business logic uses this service; never import providers directly.
// =============================================================================

import type { AIProvider } from './providers/base.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let providerInstance: AIProvider | null = null;

/**
 * Get the configured AI provider (singleton).
 * Creates the provider on first call based on AI_PROVIDER env var.
 */
export function getAIProvider(): AIProvider {
  if (providerInstance) return providerInstance;

  switch (env.aiProvider) {
    case 'gemini':
      providerInstance = new GeminiProvider();
      break;
    // Future providers:
    // case 'openai':
    //   providerInstance = new OpenAIProvider();
    //   break;
    // case 'claude':
    //   providerInstance = new ClaudeProvider();
    //   break;
    default:
      throw new Error(
        `Unknown AI provider: "${env.aiProvider}". Supported: gemini`
      );
  }

  logger.info('AI provider created', {
    provider: providerInstance.name,
    model: providerInstance.model,
  });

  return providerInstance;
}

// Re-export types for convenience
export type { AIProvider, AIAnalysisResult } from './providers/base.provider';
