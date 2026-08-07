// =============================================================================
// DOCX to HTML Conversion Service
// =============================================================================
// Uses mammoth.js to convert DOCX files into clean HTML for the editor.
// Preserves bold, italic, underline, hyperlinks, lists, and headings.
// =============================================================================

import mammoth from 'mammoth';
import { logger } from '../utils/logger';

/**
 * Convert a DOCX buffer to clean HTML using mammoth.js.
 * This is used for the rich text editor in the document sidebar.
 */
export async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  logger.info('Starting DOCX to HTML conversion');

  try {
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        // Style mapping to preserve formatting
        styleMap: [
          "b => b",
          "i => i",
          "u => u",
          "strike => s",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
        ],
      }
    );

    if (result.messages.length > 0) {
      logger.info('DOCX to HTML conversion warnings', {
        warnings: result.messages.map((m) => m.message),
      });
    }

    logger.info('DOCX to HTML conversion complete', {
      htmlLength: result.value.length,
    });

    return result.value;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to convert DOCX to HTML', { error: errorMsg });
    throw new Error(`DOCX to HTML conversion failed: ${errorMsg}`);
  }
}
