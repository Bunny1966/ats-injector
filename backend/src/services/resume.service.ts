// =============================================================================
// Resume Service — Orchestration Layer
// =============================================================================
// Coordinates the resume optimization workflow:
// Upload → Parse → Analyze → Plan Changes → Apply → Generate
// Each step delegates to specialized services/engines.
// =============================================================================

import type {
  StructuredResume,
  UploadResumeResponse,
  AnalyzeResumeResponse,
  ApplyChangesResponse,
  ChangeDecision,
  OptimizationResult,
  OptimizationMode,
} from '@resume-optimizer/shared';
import { generateSessionId } from '../utils/id';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import {
  storeSession,
  getSession,
  getFileType,
  readUploadedFile,
  writeGeneratedFile,
  getGeneratedFilePath,
  type UploadedFile,
} from './file.service';
import { parseResume } from '../parser';
import { getAIProvider } from '../ai';
import { getPatchEngine } from '../patch';
import { AppError } from '../middleware/error.middleware';
import { supabase } from '../middleware/auth.middleware';

// In-memory store for parsed resumes and analysis results.
// Will be backed by a database in production.
const resumeCache = new Map<string, StructuredResume>();
const analysisCache = new Map<string, OptimizationResult>();

/**
 * Handle resume upload: store the file and parse it.
 */
export async function handleUpload(
  file: Express.Multer.File,
  userId?: string,
  supabaseClient?: any
): Promise<UploadResumeResponse> {
  // Check the 5-resume limit if authenticated
  if (userId && supabaseClient) {
    const { count, error: countError } = await supabaseClient
      .from('resumes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      logger.error('Failed to check resume count', { error: countError });
    } else if (count !== null && count >= 5) {
      throw new AppError(
        'You have reached the maximum limit of 5 saved resumes. Please delete an old resume from your dashboard to upload a new one.',
        400,
        'LIMIT_REACHED'
      );
    }
  }

  const sessionId = generateSessionId();
  const fileType = getFileType(file.originalname);

  // Store file metadata in session
  const uploadedFile: UploadedFile = {
    sessionId,
    originalName: file.originalname,
    storedName: file.filename,
    filePath: file.path,
    fileType,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
  };

  storeSession(sessionId, uploadedFile);

  logger.info('Resume uploaded', {
    sessionId,
    fileName: file.originalname,
    fileType,
    size: `${(file.size / 1024).toFixed(1)}KB`,
  });

  // Parse the uploaded file into StructuredResume
  const buffer = readUploadedFile(file.path);
  const resume = await parseResume(buffer, file.originalname, sessionId);

  // Cache the parsed resume
  resumeCache.set(sessionId, resume);

  // Save to Supabase if authenticated
  if (userId && supabaseClient) {
    try {
      const storagePath = `${userId}/${Date.now()}_${file.originalname}`;
      
      // Upload to Storage
      const fileBuffer = readUploadedFile(file.path);
      const { error: storageError } = await supabaseClient
        .storage
        .from('resumes')
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (storageError) throw storageError;

      // Create record in DB
      const { error: dbError } = await supabaseClient
        .from('resumes')
        .insert({
          user_id: userId,
          file_name: file.originalname,
          storage_path: storagePath
        });

      if (dbError) throw dbError;
      
    } catch (error) {
      logger.error('Failed to save resume to Supabase', { error });
      // We don't throw here to allow the upload to succeed even if cloud sync fails
    }
  }

  logger.info('Resume parsed successfully', {
    sessionId,
    sections: resume.sections.length,
    sectionTitles: resume.sections.map((s: { title: string }) => s.title),
  });

  return {
    sessionId,
    resume,
    summary: {
      fileName: file.originalname,
      fileType,
      pageCount: resume.metadata.pageCount,
      sectionCount: resume.sections.length,
      sections: resume.sections.map((s: { title: string }) => s.title),
    },
  };
}

/**
 * Handle loading a previously saved resume from Supabase.
 */
export async function handleLoadSaved(
  resumeId: string,
  userId: string,
  supabaseClient: any
): Promise<UploadResumeResponse> {
  // 1. Get the resume record from the database
  const { data: resumeRecord, error: dbError } = await supabaseClient
    .from('resumes')
    .select('*')
    .eq('id', resumeId)
    .eq('user_id', userId)
    .single();

  if (dbError || !resumeRecord) {
    throw new AppError('Resume not found or access denied', 404, 'NOT_FOUND');
  }

  // 2. Download the file from storage
  const { data: fileData, error: storageError } = await supabaseClient
    .storage
    .from('resumes')
    .download(resumeRecord.storage_path);

  if (storageError || !fileData) {
    throw new AppError('Failed to download resume file', 500, 'STORAGE_ERROR');
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const sessionId = generateSessionId();
  const fileType = getFileType(resumeRecord.file_name);

  // Parse the downloaded file
  const resume = await parseResume(buffer, resumeRecord.file_name, sessionId);

  // Store minimal session info needed for processing (no local file path since it's from DB)
  // We'll save the buffer to a temp file so the patch engine can work with it
  const tempPath = path.join(process.cwd(), 'uploads', `${sessionId}_${resumeRecord.file_name}`);
  fs.writeFileSync(tempPath, buffer);

  const uploadedFile: UploadedFile = {
    sessionId,
    originalName: resumeRecord.file_name,
    storedName: `${sessionId}_${resumeRecord.file_name}`,
    filePath: tempPath,
    fileType,
    sizeBytes: buffer.length,
    uploadedAt: new Date().toISOString(),
  };

  storeSession(sessionId, uploadedFile);
  resumeCache.set(sessionId, resume);

  return {
    sessionId,
    resume,
    summary: {
      fileName: resumeRecord.file_name,
      fileType,
      pageCount: resume.metadata.pageCount,
      sectionCount: resume.sections.length,
      sections: resume.sections.map((s: { title: string }) => s.title),
    },
  };
}

/**
 * Analyze a previously uploaded resume against a job description.
 */
export async function handleAnalyze(
  sessionId: string,
  jobDescription: string,
  mode: OptimizationMode = 'quick'
): Promise<AnalyzeResumeResponse> {
  // Verify session exists
  const session = getSession(sessionId);
  if (!session) {
    throw new AppError('Session not found. Please upload a resume first.', 404, 'SESSION_NOT_FOUND');
  }

  const resume = resumeCache.get(sessionId);
  if (!resume) {
    throw new AppError('Parsed resume not found. Please re-upload.', 404, 'RESUME_NOT_FOUND');
  }

  logger.info('Starting AI analysis', {
    sessionId,
    mode,
    sections: resume.sections.length,
    jdLength: jobDescription.length,
  });

  // Get the AI provider and run analysis with mode
  const ai = getAIProvider();
  const aiResult = await ai.analyze(resume, jobDescription, mode);

  // Build the optimization result
  const result: OptimizationResult = {
    analysis: aiResult.analysis,
    changes: aiResult.changes,
    projectedScore: aiResult.projectedScore,
    modelUsed: aiResult.modelUsed,
    analyzedAt: new Date().toISOString(),
  };

  // Cache the analysis for the apply step
  analysisCache.set(sessionId, result);

  // Store the job title abbreviation in the file session for dynamic renaming later
  if (session && aiResult.analysis.jobTitleAbbreviation) {
    session.jobTitleAbbreviation = aiResult.analysis.jobTitleAbbreviation;
    storeSession(sessionId, session);
  }

  logger.info('AI analysis complete', {
    sessionId,
    mode,
    score: aiResult.analysis.overallScore,
    changes: aiResult.changes.length,
    model: aiResult.modelUsed,
  });

  return { result };
}

/**
 * Apply approved changes and generate the optimized resume.
 */
export async function handleApply(
  sessionId: string,
  decisions: ChangeDecision[]
): Promise<ApplyChangesResponse> {
  const session = getSession(sessionId);
  if (!session) {
    throw new AppError('Session not found. Please upload a resume first.', 404, 'SESSION_NOT_FOUND');
  }

  const analysis = analysisCache.get(sessionId);
  if (!analysis) {
    throw new AppError('Analysis not found. Please re-analyze.', 404, 'ANALYSIS_NOT_FOUND');
  }

  const approvedCount = decisions.filter((d) => d.status === 'approved').length;
  const rejectedCount = decisions.filter((d) => d.status === 'rejected').length;

  logger.info('Applying changes', {
    sessionId,
    fileType: session.fileType,
    approved: approvedCount,
    rejected: rejectedCount,
  });

  // Get the patch engine for this file type
  const patchEngine = getPatchEngine(session.fileType);

  if (patchEngine) {
    // DOCX: Apply changes and generate patched file
    const originalBuffer = readUploadedFile(session.filePath);
    const patchResult = await patchEngine.apply(
      originalBuffer,
      analysis.changes,
      decisions
    );

    if (patchResult.buffer) {
      // Write the generated file to disk
      const outputPath = getGeneratedFilePath(sessionId, session.fileType);
      writeGeneratedFile(outputPath, patchResult.buffer);

      logger.info('Patched file generated', {
        sessionId,
        applied: patchResult.appliedCount,
        failed: patchResult.failedCount,
        outputPath,
      });

      return {
        downloadUrl: `/api/resume/download/${sessionId}`,
        appliedCount: patchResult.appliedCount,
        rejectedCount: patchResult.rejectedCount,
        finalScore: analysis.projectedScore,
      };
    }
  }

  // PDF or no patch engine: manual mode
  logger.info('Manual mode — no file generated (PDF)', { sessionId });

  return {
    downloadUrl: '',
    appliedCount: approvedCount,
    rejectedCount,
    finalScore: analysis.projectedScore,
  };
}
