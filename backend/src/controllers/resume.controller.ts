// =============================================================================
// Resume Controller
// =============================================================================
// Handles HTTP request/response for resume operations.
// Delegates all business logic to the resume service.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import type { ApiResponse, UploadResumeResponse, AnalyzeResumeResponse, ApplyChangesResponse, GetHtmlResponse, ManualEditResponse, ChatEditResponse } from '@resume-optimizer/shared';
import * as resumeService from '../services/resume.service';
import * as editService from '../services/edit.service';
import { getSession, getGeneratedFilePath } from '../services/file.service';
import { convertDocxToPdf } from '../services/pdf.service';
import { AppError } from '../middleware/error.middleware';

/**
 * POST /api/resume/upload
 * Upload a resume file (PDF or DOCX).
 */
export async function uploadResume(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded. Please attach a resume file.', 400, 'NO_FILE');
    }

    const result = await resumeService.handleUpload(req.file, req.user?.id, req.supabase);

    const response: ApiResponse<UploadResumeResponse> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/resume/load-saved
 * Load a resume from Supabase for a user.
 */
export async function loadSavedResume(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resumeId } = req.body;
    if (!resumeId || !req.user?.id) {
      throw new AppError('resumeId and auth are required.', 400, 'MISSING_FIELDS');
    }

    const result = await resumeService.handleLoadSaved(resumeId, req.user.id, req.supabase);

    const response: ApiResponse<UploadResumeResponse> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/resume/saved
 * Fetch a user's saved resumes
 */
export async function getSavedResumes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const { data, error } = await req.supabase!
      .from('resumes')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/resume/set-default
 * Mark a resume as the default
 */
export async function setDefaultResume(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resumeId, isDefault = true } = req.body;
    if (!resumeId || !req.user?.id) {
      throw new AppError('resumeId and auth are required.', 400, 'MISSING_FIELDS');
    }

    const { error } = await req.supabase!
      .from('resumes')
      .update({ is_default: isDefault })
      .eq('id', resumeId)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Supabase update error:', error);
      throw new AppError(`Supabase error: ${error.message || JSON.stringify(error)}`, 500, 'DB_ERROR');
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/resume/:id
 * Delete a saved resume
 */
export async function deleteResume(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || !req.user?.id) {
      throw new AppError('resumeId and auth are required.', 400, 'MISSING_FIELDS');
    }

    // First get the storage path
    const { data: resume, error: fetchError } = await req.supabase!
      .from('resumes')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
      
    if (fetchError || !resume) throw new AppError('Resume not found', 404, 'NOT_FOUND');

    // Delete from Storage
    await req.supabase!.storage.from('resumes').remove([resume.storage_path]);
    
    // Delete from DB
    const { error: deleteError } = await req.supabase!
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (deleteError) throw deleteError;

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/resume/analyze
 * Analyze a resume against a job description.
 */
export async function analyzeResume(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId, jobDescription, mode } = req.body;

    if (!sessionId || !jobDescription) {
      throw new AppError(
        'Both sessionId and jobDescription are required.',
        400,
        'MISSING_FIELDS'
      );
    }

    const result = await resumeService.handleAnalyze(sessionId, jobDescription, mode || 'quick');

    const response: ApiResponse<AnalyzeResumeResponse> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/resume/apply
 * Apply approved changes and generate the optimized resume.
 */
export async function applyChanges(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId, decisions } = req.body;

    if (!sessionId || !decisions) {
      throw new AppError(
        'Both sessionId and decisions are required.',
        400,
        'MISSING_FIELDS'
      );
    }

    const result = await resumeService.handleApply(sessionId, decisions);

    const response: ApiResponse<ApplyChangesResponse> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/resume/download/:sessionId
 * Download the generated optimized resume file.
 */
export async function downloadResume(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;

    const session = getSession(sessionId);
    if (!session) {
      throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
    }

    const filePath = getGeneratedFilePath(sessionId, session.fileType);

    if (!fs.existsSync(filePath)) {
      throw new AppError(
        'Generated file not found. Please apply changes first.',
        404,
        'FILE_NOT_FOUND'
      );
    }

    // Determine the content type and filename
    const ext = session.fileType === 'pdf' ? '.pdf' : '.docx';
    const contentType =
      session.fileType === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Build a nice download filename
    const baseName = path.basename(
      session.originalName,
      path.extname(session.originalName)
    );
    const suffix = session.jobTitleAbbreviation ? `_${session.jobTitleAbbreviation}` : '_optimized';
    const downloadName = `${baseName}${suffix}${ext}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadName}"`
    );

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/resume/download/:sessionId/pdf
 * Download the generated optimized resume as PDF (converted from DOCX via LibreOffice).
 */
export async function downloadResumeAsPdf(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;

    const session = getSession(sessionId);
    if (!session) {
      throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
    }

    // We can only convert DOCX to PDF
    if (session.fileType !== 'docx') {
      throw new AppError(
        'PDF conversion is only available for DOCX files.',
        400,
        'INVALID_FILE_TYPE'
      );
    }

    const docxPath = getGeneratedFilePath(sessionId, 'docx');

    if (!fs.existsSync(docxPath)) {
      throw new AppError(
        'Generated DOCX file not found. Please apply changes first.',
        404,
        'FILE_NOT_FOUND'
      );
    }

    // Convert DOCX → PDF via LibreOffice
    const pdfPath = await convertDocxToPdf(docxPath);

    // Build a nice download filename
    const baseName = path.basename(
      session.originalName,
      path.extname(session.originalName)
    );
    const suffix = session.jobTitleAbbreviation ? `_${session.jobTitleAbbreviation}` : '_optimized';
    const downloadName = `${baseName}${suffix}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadName}"`
    );

    // Stream the PDF file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/resume/chatEdit
 * Process an AI-interpreted editing command from the chat.
 */
export async function chatEdit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId, instruction } = req.body;

    if (!sessionId || !instruction) {
      throw new AppError(
        'sessionId and instruction are required.',
        400,
        'MISSING_FIELDS'
      );
    }

    const result = await editService.handleChatEdit(sessionId, instruction);

    const response: ApiResponse<ChatEditResponse> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
