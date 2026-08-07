// =============================================================================
// AI Provider — Abstract Base
// =============================================================================
// Strategy pattern interface for AI providers.
// All business logic uses this interface; concrete providers implement it.
// =============================================================================

import type { StructuredResume, ATSAnalysisResult, ChangeRecommendation, OptimizationMode } from '@resume-optimizer/shared';

/**
 * Result of a full optimization analysis.
 */
export interface AIAnalysisResult {
  analysis: ATSAnalysisResult;
  changes: ChangeRecommendation[];
  projectedScore: number;
  modelUsed: string;
}

/**
 * Abstract interface for AI providers.
 * Implement this to add support for a new AI service (OpenAI, Claude, etc.).
 */
export interface AIProvider {
  /** Human-readable name of this provider. */
  readonly name: string;

  /** Model identifier being used. */
  readonly model: string;

  /**
   * Perform a full resume optimization analysis.
   * @param resume - The structured resume data
   * @param jobDescription - The target job description text
   * @param mode - Optimization intensity ('quick' or 'full')
   * @returns Analysis results with ATS score and change recommendations
   */
  analyze(
    resume: StructuredResume,
    jobDescription: string,
    mode?: OptimizationMode
  ): Promise<AIAnalysisResult>;
}
