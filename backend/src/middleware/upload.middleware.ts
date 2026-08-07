// =============================================================================
// File Upload Middleware (Multer)
// =============================================================================
// Configures multer for resume file uploads with validation.
// Files are stored locally in the uploads/ directory during development.
// =============================================================================

import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { SUPPORTED_MIME_TYPES, SUPPORTED_EXTENSIONS } from '../config/constants';
import { AppError } from './error.middleware';

/**
 * Multer disk storage configuration.
 * Files are saved with a unique name to prevent collisions.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

/**
 * File filter to validate uploaded file types.
 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isSupportedMime = (SUPPORTED_MIME_TYPES as readonly string[]).includes(file.mimetype);
  const isSupportedExt = (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);

  if (isSupportedMime || isSupportedExt) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Unsupported file type: ${ext}. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`,
        400,
        'UNSUPPORTED_FILE_TYPE'
      )
    );
  }
};

/**
 * Configured multer instance for single resume file upload.
 * Usage: uploadMiddleware.single('resume')
 */
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
    files: 1,
  },
});
