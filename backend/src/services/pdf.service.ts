// =============================================================================
// PDF Service — DOCX to PDF Conversion via LibreOffice
// =============================================================================
// Uses LibreOffice headless mode to convert DOCX files to PDF.
// Designed for Docker deployments (Render free tier).
// Falls back gracefully if LibreOffice is not installed (local dev).
// =============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * Convert a DOCX file to PDF using LibreOffice headless.
 * 
 * @param docxPath - Absolute path to the input .docx file.
 * @returns Absolute path to the generated .pdf file.
 * @throws Error if LibreOffice is not available or conversion fails.
 */
export async function convertDocxToPdf(docxPath: string): Promise<string> {
  if (!fs.existsSync(docxPath)) {
    throw new Error(`DOCX file not found: ${docxPath}`);
  }

  const outputDir = path.dirname(docxPath);
  const baseName = path.basename(docxPath, '.docx');
  const expectedPdfPath = path.join(outputDir, `${baseName}.pdf`);

  // If a cached PDF already exists, return it
  if (fs.existsSync(expectedPdfPath)) {
    logger.info('Using cached PDF', { path: expectedPdfPath });
    return expectedPdfPath;
  }

  logger.info('Converting DOCX to PDF via LibreOffice', { docxPath, outputDir });

  try {
    // Determine the correct LibreOffice command based on the OS
    const libreOfficeCmd = process.platform === 'win32' ? 'soffice' : 'libreoffice';

    // Use LibreOffice in headless mode for conversion
    // --norestore: don't try to recover crashed documents
    // --convert-to pdf: output format
    // --outdir: where to write the PDF
    const cmd = `"${libreOfficeCmd}" --headless --norestore --convert-to pdf --outdir "${outputDir}" "${docxPath}"`;

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 60_000, // 60 second timeout
      env: {
        ...process.env,
        HOME: '/tmp', // LibreOffice needs a writable HOME directory
      },
    });

    if (stderr && !stderr.includes('warn')) {
      logger.warn('LibreOffice stderr output', { stderr: stderr.trim() });
    }

    logger.info('LibreOffice conversion output', { stdout: stdout.trim() });

    // Verify the PDF was actually created
    if (!fs.existsSync(expectedPdfPath)) {
      throw new Error(
        `LibreOffice ran but PDF was not created at expected path: ${expectedPdfPath}`
      );
    }

    logger.info('DOCX to PDF conversion successful', { pdfPath: expectedPdfPath });
    return expectedPdfPath;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);

    // Check if LibreOffice is simply not installed
    if (msg.includes('ENOENT') || msg.includes('not found') || msg.includes('not recognized')) {
      throw new Error(
        'LibreOffice is not installed on this system. ' +
        'PDF conversion requires running inside the Docker container. ' +
        'For local development, use the DOCX download instead.'
      );
    }

    throw new Error(`DOCX to PDF conversion failed: ${msg}`);
  }
}

/**
 * Check whether LibreOffice is available on this system.
 * Useful for feature-flagging the PDF download button.
 */
export async function isLibreOfficeAvailable(): Promise<boolean> {
  try {
    const libreOfficeCmd = process.platform === 'win32' ? 'soffice' : 'libreoffice';
    await execAsync(`"${libreOfficeCmd}" --version`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
