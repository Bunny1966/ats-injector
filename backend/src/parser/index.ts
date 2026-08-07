// =============================================================================
// Parser Factory
// =============================================================================
// Auto-detects file type and routes to the correct parser implementation.
// =============================================================================

import path from 'path';
import type { FileType, StructuredResume } from '@resume-optimizer/shared';
import { DocxParser } from './docx.parser';
import { PdfParser } from './pdf.parser';
import type { DocumentParser } from './types';
import { logger } from '../utils/logger';

const parsers: Record<FileType, DocumentParser> = {
  docx: new DocxParser(),
  pdf: new PdfParser(),
};

/**
 * Detect file type from filename extension.
 */
export function detectFileType(fileName: string): FileType {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.docx') return 'docx';
  if (ext === '.pdf') return 'pdf';
  throw new Error(`Unsupported file type: ${ext}`);
}

/**
 * Parse a document file into a StructuredResume.
 * Automatically selects the correct parser based on file extension.
 */
export async function parseResume(
  buffer: Buffer,
  fileName: string,
  sessionId: string
): Promise<StructuredResume> {
  const fileType = detectFileType(fileName);
  const parser = parsers[fileType];

  logger.info('Parser factory: routing to parser', { fileType, fileName });

  return parser.parse(buffer, fileName, sessionId);
}
