// =============================================================================
// ID Generation Utility
// =============================================================================

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique session ID for a resume processing session.
 */
export function generateSessionId(): string {
  return `session_${uuidv4()}`;
}

/**
 * Generate a unique ID for a resume section.
 */
export function generateSectionId(): string {
  return `sec_${uuidv4().slice(0, 8)}`;
}

/**
 * Generate a unique ID for a content element.
 */
export function generateContentId(): string {
  return `cnt_${uuidv4().slice(0, 8)}`;
}

/**
 * Generate a unique ID for a change recommendation.
 */
export function generateChangeId(): string {
  return `chg_${uuidv4().slice(0, 8)}`;
}
