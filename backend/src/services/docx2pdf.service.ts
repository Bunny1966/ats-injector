import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * Converts a DOCX file to a PDF file using docx2pdf (which uses MS Word COM automation).
 * Returns the path to the generated PDF file.
 */
export async function convertDocxToPdf(docxPath: string): Promise<string> {
  const pdfPath = docxPath.replace(/\.docx$/i, '.pdf');


  logger.info('Starting DOCX to PDF conversion', { docxPath, pdfPath });

  try {
    // Run docx2pdf using inline python script
    // Note: This requires python and docx2pdf to be installed and available in the PATH.
    // Also requires Microsoft Word installed on this Windows machine.
    // We escape backslashes in the paths for the python script string
    const escapedDocxPath = docxPath.replace(/\\/g, '\\\\');
    const escapedPdfPath = pdfPath.replace(/\\/g, '\\\\');
    
    try {
      await execAsync(`python -c "from docx2pdf import convert; convert('${escapedDocxPath}', '${escapedPdfPath}')"`);
    } catch (execError) {
      // docx2pdf often throws an error at the very end when trying to close Word (e.g. AttributeError: Word.Application.Quit)
      // If the PDF was actually created before this cleanup error occurred, we can safely ignore the error.
      if (!fs.existsSync(pdfPath)) {
        throw execError;
      }
      logger.warn('docx2pdf threw an error during cleanup, but PDF was generated successfully', { error: String(execError) });
    }
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF was not created for unknown reasons.`);
    }

    logger.info('Successfully converted DOCX to PDF', { pdfPath });
    return pdfPath;
  } catch (error) {
    logger.error('Failed to convert DOCX to PDF', {
      error: String(error),
      docxPath,
    });
    throw error;
  }
}
