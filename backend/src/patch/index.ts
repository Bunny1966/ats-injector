// =============================================================================
// Patch Engine Factory
// =============================================================================
// Returns the appropriate patch engine based on file type.
// - DOCX: In-place XML text replacement (fully automated)
// - PDF: No patching (user applies changes manually)
// =============================================================================

import type { FileType } from '@resume-optimizer/shared';
import { DocxPatchEngine } from './docx-patch.engine';
import type { PatchEngine } from './types';

export type { PatchEngine, PatchResult } from './types';

/**
 * Get the patch engine for the given file type.
 * Returns null for PDF (manual mode — no automated patching).
 */
export function getPatchEngine(fileType: FileType): PatchEngine | null {
  switch (fileType) {
    case 'docx':
      return new DocxPatchEngine();
    case 'pdf':
      // PDFs cannot be reliably edited without breaking formatting.
      // The user will apply changes manually.
      return null;
    default:
      return null;
  }
}
