// =============================================================================
// Resume Routes
// =============================================================================

import { Router } from 'express';
import * as resumeController from '../controllers/resume.controller';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/resume/upload
 * Upload a resume file for parsing.
 * Expects multipart/form-data with field name 'resume'.
 */
router.post('/upload', requireAuth, uploadMiddleware.single('resume'), resumeController.uploadResume);

/**
 * POST /api/resume/load-saved
 * Load a resume from Supabase for a user.
 */
router.post('/load-saved', requireAuth, resumeController.loadSavedResume);

/**
 * GET /api/resume/saved
 * Get all saved resumes for a user.
 */
router.get('/saved', requireAuth, resumeController.getSavedResumes);

/**
 * POST /api/resume/set-default
 * Mark a resume as the default.
 */
router.post('/set-default', requireAuth, resumeController.setDefaultResume);

/**
 * DELETE /api/resume/:id
 * Delete a saved resume.
 */
router.delete('/:id', requireAuth, resumeController.deleteResume);

/**
 * POST /api/resume/analyze
 * Analyze a parsed resume against a job description.
 * Body: { sessionId: string, jobDescription: string }
 */
router.post('/analyze', requireAuth, resumeController.analyzeResume);

/**
 * POST /api/resume/apply
 * Apply approved changes and generate the optimized resume.
 * Body: { sessionId: string, decisions: ChangeDecision[] }
 */
router.post('/apply', requireAuth, resumeController.applyChanges);

/**
 * GET /api/resume/download/:sessionId
 * Download the generated optimized resume.
 */
router.get('/download/:sessionId', resumeController.downloadResume);

/**
 * GET /api/resume/download/:sessionId/pdf
 * Download the generated optimized resume as PDF (converted from DOCX via LibreOffice).
 */
router.get('/download/:sessionId/pdf', resumeController.downloadResumeAsPdf);

/**
 * POST /api/resume/chatEdit
 * Process an AI-interpreted editing command from the chat.
 */
router.post('/chatEdit', requireAuth, resumeController.chatEdit);

export default router;
