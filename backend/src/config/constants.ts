// =============================================================================
// Application Constants
// =============================================================================

/** Supported file MIME types for resume upload. */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
] as const;

/** Supported file extensions. */
export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx'] as const;

/** Maximum file size in bytes (default 10MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** API version prefix. */
export const API_PREFIX = '/api';

/** Session data time-to-live in milliseconds (1 hour). */
export const SESSION_TTL_MS = 60 * 60 * 1000;
