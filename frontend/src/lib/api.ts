// =============================================================================
// API Client — Axios instance configured for the backend
// =============================================================================

import axios from 'axios';
import type {
  ApiResponse,
  UploadResumeResponse,
  AnalyzeResumeResponse,
  ApplyChangesResponse,
  ChangeDecision,
  OptimizationMode,
  GetHtmlResponse,
  ManualEdit,
  ManualEditResponse,
  ChatEditResponse,
} from '@resume-optimizer/shared';

import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/** Configured Axios instance with base URL and timeout. */
const api = axios.create({
  baseURL: API_URL,
  timeout: 120_000, // 2 minutes for AI analysis
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    // Ignore errors in SSR or if Supabase is not configured yet
  }
  return config;
});

/**
 * Upload a resume file (PDF or DOCX).
 */
export async function uploadResume(
  file: File
): Promise<ApiResponse<UploadResumeResponse>> {
  const formData = new FormData();
  formData.append('resume', file);

  const { data } = await api.post<ApiResponse<UploadResumeResponse>>(
    '/resume/upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return data;
}

/**
 * Load a previously saved resume from Supabase.
 */
export async function loadSavedResume(
  resumeId: string
): Promise<ApiResponse<UploadResumeResponse>> {
  const { data } = await api.post<ApiResponse<UploadResumeResponse>>(
    '/resume/load-saved',
    { resumeId }
  );
  return data;
}

export interface SavedResume {
  id: string;
  file_name: string;
  is_default: boolean;
  created_at: string;
}

/**
 * Fetch all saved resumes for the user.
 */
export async function getSavedResumes(): Promise<ApiResponse<SavedResume[]>> {
  const { data } = await api.get<ApiResponse<SavedResume[]>>('/resume/saved');
  return data;
}

/**
 * Mark a resume as default.
 */
export async function setDefaultResume(resumeId: string, isDefault: boolean = true): Promise<ApiResponse<void>> {
  const { data } = await api.post<ApiResponse<void>>('/resume/set-default', { resumeId, isDefault });
  return data;
}

/**
 * Delete a saved resume.
 */
export async function deleteSavedResume(resumeId: string): Promise<ApiResponse<void>> {
  const { data } = await api.delete<ApiResponse<void>>(`/resume/${resumeId}`);
  return data;
}

/**
 * Analyze a resume against a job description.
 */
export async function analyzeResume(
  sessionId: string,
  jobDescription: string,
  mode: OptimizationMode = 'quick'
): Promise<ApiResponse<AnalyzeResumeResponse>> {
  const { data } = await api.post<ApiResponse<AnalyzeResumeResponse>>(
    '/resume/analyze',
    { sessionId, jobDescription, mode }
  );
  return data;
}

/**
 * Apply approved changes and generate the optimized resume.
 */
export async function applyChanges(
  sessionId: string,
  decisions: ChangeDecision[]
): Promise<ApiResponse<ApplyChangesResponse>> {
  const { data } = await api.post<ApiResponse<ApplyChangesResponse>>(
    '/resume/apply',
    { sessionId, decisions }
  );
  return data;
}

/**
 * Check backend health.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const { data } = await api.get('/health');
    return data.success === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Document Editor API
// ---------------------------------------------------------------------------

/**
 * Get the HTML representation of the resume for the rich text editor.
 */
export async function getResumeHtml(
  sessionId: string
): Promise<ApiResponse<GetHtmlResponse>> {
  const { data } = await api.get<ApiResponse<GetHtmlResponse>>(
    `/resume/html/${sessionId}`
  );
  return data;
}

/**
 * Save manual text edits from the rich text editor.
 */
export async function saveManualEdits(
  sessionId: string,
  edits: ManualEdit[]
): Promise<ApiResponse<ManualEditResponse>> {
  const { data } = await api.post<ApiResponse<ManualEditResponse>>(
    '/resume/manualEdit',
    { sessionId, edits }
  );
  return data;
}

/**
 * Send a natural language editing command via AI chat.
 */
export async function sendChatEdit(
  sessionId: string,
  instruction: string
): Promise<ApiResponse<ChatEditResponse>> {
  const { data } = await api.post<ApiResponse<ChatEditResponse>>(
    '/resume/chatEdit',
    { sessionId, instruction }
  );
  return data;
}

/**
 * Get the URL for inline PDF preview.
 */
export function getPreviewPdfUrl(sessionId: string): string {
  const baseUrl = API_URL.replace('/api', '');
  return `${baseUrl}/api/resume/previewPdf/${sessionId}`;
}

export default api;
