// =============================================================================
// File Service
// =============================================================================
// Manages file operations for uploaded resumes and generated output.
// Handles file storage, retrieval, cleanup, and session-based file tracking.
// =============================================================================

import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { FileType } from '@resume-optimizer/shared';

/**
 * Metadata about an uploaded file.
 */
export interface UploadedFile {
  sessionId: string;
  originalName: string;
  storedName: string;
  filePath: string;
  fileType: FileType;
  sizeBytes: number;
  uploadedAt: string;
  jobTitleAbbreviation?: string;
}

/**
 * In-memory session store for uploaded files.
 * In production, this would be backed by a database or Redis.
 */
const sessionStore = new Map<string, UploadedFile>();

/**
 * Ensure required directories exist.
 */
export function ensureDirectories(): void {
  const dirs = [env.uploadDir, env.generatedDir];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

/**
 * Determine the FileType from a file extension.
 */
export function getFileType(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  throw new Error(`Unsupported file extension: ${ext}`);
}

/**
 * Store an uploaded file's metadata in the session store.
 */
export function storeSession(sessionId: string, file: UploadedFile): void {
  sessionStore.set(sessionId, file);
  logger.info('Session stored', { sessionId, fileName: file.originalName });
}

/**
 * Retrieve an uploaded file's metadata by session ID.
 */
export function getSession(sessionId: string): UploadedFile | undefined {
  return sessionStore.get(sessionId);
}

/**
 * Get the full path for a generated output file.
 */
export function getGeneratedFilePath(sessionId: string, fileType: FileType): string {
  const ext = fileType === 'pdf' ? '.pdf' : '.docx';
  return path.join(env.generatedDir, `${sessionId}_optimized${ext}`);
}

/**
 * Read an uploaded file as a Buffer.
 */
export function readUploadedFile(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

/**
 * Write a generated file to disk.
 */
export function writeGeneratedFile(filePath: string, data: Buffer): void {
  fs.writeFileSync(filePath, data);
  logger.info('Generated file written', { filePath });
}

/**
 * Clean up old session files (called periodically or on session expiry).
 */
export function cleanupSession(sessionId: string): void {
  const session = sessionStore.get(sessionId);
  if (session) {
    // Remove uploaded file
    if (fs.existsSync(session.filePath)) {
      fs.unlinkSync(session.filePath);
    }
    // Remove generated file
    const generatedPath = getGeneratedFilePath(sessionId, session.fileType);
    if (fs.existsSync(generatedPath)) {
      fs.unlinkSync(generatedPath);
    }
    sessionStore.delete(sessionId);
    logger.info('Session cleaned up', { sessionId });
  }
}

/**
 * Automatically clean up files older than a specified duration.
 * Runs on a setInterval in the background.
 */
export function startAutoCleanup(): void {
  const CLEANUP_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
  const MAX_FILE_AGE_MS = 20 * 60 * 1000; // 20 minutes

  logger.info(`🧹 Auto-cleanup cron initialized. Running every ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes.`);

  setInterval(() => {
    logger.info('Running scheduled background file cleanup...');
    const now = Date.now();
    const dirsToClean = [env.uploadDir, env.generatedDir];
    let deletedCount = 0;

    for (const dir of dirsToClean) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        // Skip hidden files like .gitkeep
        if (file.startsWith('.')) continue;

        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          const ageMs = now - stats.mtimeMs;

          // If the file is older than 20 minutes, delete it
          if (ageMs > MAX_FILE_AGE_MS) {
            fs.unlinkSync(filePath);
            deletedCount++;
            
            // Also attempt to remove from session map if it's an uploaded file
            // (filename is structured as timestamp_originalname)
            for (const [sessionId, session] of sessionStore.entries()) {
              if (session.filePath === filePath || getGeneratedFilePath(sessionId, 'docx') === filePath || getGeneratedFilePath(sessionId, 'pdf') === filePath) {
                sessionStore.delete(sessionId);
              }
            }
          }
        } catch (err) {
          logger.error(`Failed to stat/delete file during cleanup: ${filePath}`, { error: err });
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(`🧹 Cleanup complete: Deleted ${deletedCount} old files.`);
    }
  }, CLEANUP_INTERVAL_MS);
}
