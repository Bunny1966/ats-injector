// =============================================================================
// Parser Types
// =============================================================================

import type { StructuredResume, FileType } from '@resume-optimizer/shared';

/**
 * Interface that all document parsers must implement.
 */
export interface DocumentParser {
  /** The file type this parser handles. */
  readonly fileType: FileType;

  /**
   * Parse a document buffer into a StructuredResume.
   * @param buffer - The raw file bytes
   * @param fileName - Original file name
   * @param sessionId - Session ID for this upload
   */
  parse(buffer: Buffer, fileName: string, sessionId: string): Promise<StructuredResume>;
}
