// =============================================================================
// Patch Engine Types
// =============================================================================
// Defines the interface for document patching engines.
// Each file format (DOCX, PDF) implements PatchEngine differently.
// =============================================================================

import type { ChangeRecommendation, ChangeDecision } from '@resume-optimizer/shared';

/**
 * Result of applying patches to a document.
 */
export interface PatchResult {
  /** The modified document as a Buffer (for DOCX). Null for PDF (manual mode). */
  buffer: Buffer | null;
  /** Number of changes successfully applied. */
  appliedCount: number;
  /** Number of changes rejected by the user. */
  rejectedCount: number;
  /** Number of changes that failed to apply (e.g., text not found). */
  failedCount: number;
  /** Details of what was applied. */
  appliedChanges: string[];
}

/**
 * Interface that all patch engines must implement.
 */
export interface PatchEngine {
  /**
   * Apply approved changes to the original document.
   * @param originalBuffer - The original uploaded file as a Buffer
   * @param changes - All change recommendations from the AI
   * @param decisions - User's approve/reject decisions
   * @returns The patched document result
   */
  apply(
    originalBuffer: Buffer,
    changes: ChangeRecommendation[],
    decisions: ChangeDecision[]
  ): Promise<PatchResult>;
}
