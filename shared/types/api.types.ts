// =============================================================================
// API Types — Request and response shapes for the REST API
// =============================================================================
// These types define the contract between frontend and backend.
// Both sides import from this package to ensure type safety across the boundary.
// =============================================================================

import type { StructuredResume } from './resume.types';
import type { OptimizationResult, ChangeStatus } from './change.types';

// ---------------------------------------------------------------------------
// Generic API Response Wrapper
// ---------------------------------------------------------------------------

/**
 * Standard API response envelope.
 * All API responses follow this shape for consistent error handling.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Resume Upload
// ---------------------------------------------------------------------------

/**
 * Response after successfully uploading and parsing a resume.
 */
export interface UploadResumeResponse {
  /** Unique session ID for this resume processing session. */
  sessionId: string;
  /** The structured representation of the parsed resume. */
  resume: StructuredResume;
  /** Human-readable summary of what was parsed. */
  summary: {
    fileName: string;
    fileType: string;
    pageCount: number;
    sectionCount: number;
    sections: string[];
  };
}

// ---------------------------------------------------------------------------
// Resume Analysis (ATS + Change Planning)
// ---------------------------------------------------------------------------

/**
 * Optimization intensity mode.
 * - 'quick': Same field — light keyword swaps, 4-5 changes. Layout-safe.
 * - 'full': Career pivot — aggressive reframing, 10-15 changes across all sections.
 */
export type OptimizationMode = 'quick' | 'balanced' | 'full';

/**
 * Request body to analyze a resume against a job description.
 */
export interface AnalyzeResumeRequest {
  /** The session ID from the upload step. */
  sessionId: string;
  /** The job description text pasted by the user. */
  jobDescription: string;
  /** Optimization mode — 'quick' for light ATS boost, 'full' for career pivot. */
  mode?: OptimizationMode;
}

/**
 * Response containing the full optimization analysis and change plan.
 */
export interface AnalyzeResumeResponse {
  /** The complete optimization result. */
  result: OptimizationResult;
}

// ---------------------------------------------------------------------------
// Apply Changes
// ---------------------------------------------------------------------------

/**
 * A single change decision from the user.
 */
export interface ChangeDecision {
  /** The change recommendation ID. */
  changeId: string;
  /** Whether the user approved or rejected this change. */
  status: Extract<ChangeStatus, 'approved' | 'rejected'>;
  /** If the user manually edited the proposed text, this overrides the AI suggestion. */
  editedProposed?: string;
}

/**
 * Request body to apply approved changes and generate the optimized resume.
 */
export interface ApplyChangesRequest {
  /** The session ID from the upload step. */
  sessionId: string;
  /** List of user decisions for each change. */
  decisions: ChangeDecision[];
}

/**
 * Response after successfully generating the optimized resume.
 */
export interface ApplyChangesResponse {
  /** URL to download the optimized resume (.docx). */
  downloadUrl: string;
  /** Number of changes that were applied. */
  appliedCount: number;
  /** Number of changes that were rejected. */
  rejectedCount: number;
  /** The final ATS score after applying changes. */
  finalScore: number;
}

// ---------------------------------------------------------------------------
// Chat Messages (for the chat interface)
// ---------------------------------------------------------------------------

/**
 * Types of messages in the chat interface.
 */
export type ChatMessageType =
  | 'user-upload'        // User uploaded a file
  | 'user-jd'            // User pasted a job description
  | 'user-edit'          // User sent an edit command
  | 'system-parsing'     // System is parsing the resume
  | 'system-parsed'      // System finished parsing
  | 'system-analyzing'   // System is analyzing with AI
  | 'system-analysis'    // System returned analysis results
  | 'system-changes'     // System presenting changes for review
  | 'system-applying'    // System is applying changes
  | 'system-complete'    // System finished, download ready
  | 'system-editing'     // System is processing an edit command
  | 'system-edited'      // System finished applying an edit
  | 'system-error';      // An error occurred

/**
 * A single message in the chat interface.
 */
export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  content: string;
  timestamp: string;
  data?: {
    resume?: StructuredResume;
    result?: OptimizationResult;
    downloadUrl?: string;
    pdfDownloadUrl?: string;
    error?: string;
    fileName?: string;
    fileSize?: number;
  };
}

// ---------------------------------------------------------------------------
// Document Editor — HTML Retrieval
// ---------------------------------------------------------------------------

/**
 * Response containing the HTML representation of the resume for editing.
 */
export interface GetHtmlResponse {
  /** The HTML content of the resume, converted from DOCX via mammoth. */
  html: string;
}

// ---------------------------------------------------------------------------
// Document Editor — Manual Edits
// ---------------------------------------------------------------------------

/**
 * A single text-level edit from the frontend rich text editor.
 */
export interface ManualEdit {
  /** The original text to find in the document. */
  original: string;
  /** The replacement text. */
  replacement: string;
}

/**
 * Request body for applying manual edits from the rich text editor.
 */
export interface ManualEditRequest {
  /** The session ID. */
  sessionId: string;
  /** List of text-level edits to apply. */
  edits: ManualEdit[];
}

/**
 * Response after applying manual edits.
 */
export interface ManualEditResponse {
  /** Number of edits successfully applied. */
  appliedCount: number;
  /** Number of edits that failed to apply. */
  failedCount: number;
}

// ---------------------------------------------------------------------------
// Document Editor — AI Chat Edits
// ---------------------------------------------------------------------------

/**
 * Request body for AI-interpreted editing commands from the chat.
 */
export interface ChatEditRequest {
  /** The session ID. */
  sessionId: string;
  /** The natural language editing instruction from the user. */
  instruction: string;
}

/**
 * Response after processing an AI chat edit command.
 */
export interface ChatEditResponse {
  /** Number of edits applied. */
  appliedCount: number;
  /** Human-readable summary of what was done. */
  message: string;
  /** List of descriptions for each applied edit. */
  editsApplied: string[];
  /** URL to download the updated DOCX (if edits were applied). */
  downloadUrl?: string;
}

