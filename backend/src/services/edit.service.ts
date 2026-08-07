// =============================================================================
// Edit Service — Manual & AI-driven document editing
// =============================================================================
// Handles both manual edits from the rich text editor and
// AI-interpreted natural language editing commands from the chat.
// =============================================================================

import type {
  ManualEditResponse,
  ChatEditResponse,
  ManualEdit,
} from '@resume-optimizer/shared';
import { logger } from '../utils/logger';
import {
  getSession,
  readUploadedFile,
  writeGeneratedFile,
  getGeneratedFilePath,
} from './file.service';
import { convertDocxToHtml } from './docx2html.service';
import { getPatchEngine } from '../patch';
import { AppError } from '../middleware/error.middleware';
import { getEditSystemPrompt, buildEditPrompt } from '../ai/prompts/edit-prompt';
import PizZip from 'pizzip';
import fs from 'fs';

// Cache the latest HTML for each session
const htmlCache = new Map<string, string>();

/**
 * Get the HTML representation of the resume for the editor.
 * Returns cached HTML if available, otherwise converts the DOCX.
 */
export async function handleGetHtml(sessionId: string): Promise<string> {
  const session = getSession(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  // Check if there's a generated (patched) file — use that if available
  const generatedPath = getGeneratedFilePath(sessionId, session.fileType);
  let buffer: Buffer;

  if (fs.existsSync(generatedPath)) {
    buffer = fs.readFileSync(generatedPath);
    logger.info('Using generated file for HTML conversion', { sessionId });
  } else {
    buffer = readUploadedFile(session.filePath);
    logger.info('Using original file for HTML conversion', { sessionId });
  }

  const html = await convertDocxToHtml(buffer);
  htmlCache.set(sessionId, html);
  return html;
}

/**
 * Apply manual text edits from the rich text editor.
 * Uses the DocxPatchEngine to apply text replacements to the DOCX.
 */
export async function handleManualEdits(
  sessionId: string,
  edits: ManualEdit[]
): Promise<ManualEditResponse> {
  const session = getSession(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  logger.info('Applying manual edits', { sessionId, editCount: edits.length });

  const patchEngine = getPatchEngine(session.fileType);
  if (!patchEngine) {
    throw new AppError('Manual editing is only supported for DOCX files.', 400, 'UNSUPPORTED_FILE_TYPE');
  }

  // Read the current file (generated if exists, otherwise original)
  const generatedPath = getGeneratedFilePath(sessionId, session.fileType);
  let buffer: Buffer;

  if (fs.existsSync(generatedPath)) {
    buffer = fs.readFileSync(generatedPath);
  } else {
    buffer = readUploadedFile(session.filePath);
  }

  // Convert manual edits to change recommendations format for the patch engine
  let appliedCount = 0;
  let failedCount = 0;
  let currentBuffer = buffer;

  for (const edit of edits) {
    try {
      const changes = [{
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'modification' as const,
        targetId: '',
        sectionId: '',
        sectionTitle: '',
        original: edit.original,
        proposed: edit.replacement,
        reason: 'Manual edit',
        confidence: 'high' as const,
        atsImpact: 'medium' as const,
        category: 'keyword' as const,
        matchedKeywords: [],
        status: 'pending' as const,
      }];

      const decisions = [{ changeId: changes[0].id, status: 'approved' as const }];
      const result = await patchEngine.apply(currentBuffer, changes, decisions);

      if (result.buffer && result.appliedCount > 0) {
        currentBuffer = result.buffer;
        appliedCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      logger.warn('Failed to apply manual edit', { error: String(error), original: edit.original.slice(0, 50) });
      failedCount++;
    }
  }

  // Write the patched file
  if (appliedCount > 0) {
    writeGeneratedFile(generatedPath, currentBuffer);

    // Clear HTML cache so next fetch gets fresh HTML
    htmlCache.delete(sessionId);

    logger.info('Manual edits applied', { sessionId, appliedCount, failedCount });
    return { appliedCount, failedCount };
  }

  return { appliedCount: 0, failedCount };
}

/**
 * Extract all text from the DOCX's word/document.xml, grouped by paragraph.
 * Returns an array of paragraph texts.
 */
function extractDocxParagraphTexts(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml');
  if (!docXml) return [];

  const xml = docXml.asText();
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const texts: string[] = [];
  let pMatch;

  while ((pMatch = paragraphRegex.exec(xml)) !== null) {
    const textRegex = /<w:t(?:>| [^>]*>)([\s\S]*?)<\/w:t>/g;
    let fullText = '';
    let tMatch;
    while ((tMatch = textRegex.exec(pMatch[0])) !== null) {
      fullText += tMatch[1];
    }
    if (fullText.trim()) {
      texts.push(fullText);
    }
  }

  return texts;
}

/**
 * For "removeText" edits where the target is a substring (e.g. "NextJS" within
 * "Frameworks: React, MERN stack, NextJS, Tailwind CSS"), find the full
 * paragraph line containing the target and build a proper replacement.
 */
function resolveSubstringEdit(
  paragraphTexts: string[],
  targetText: string,
  replacement: string
): ManualEdit | null {
  const normalizedTarget = targetText.trim().toLowerCase();

  for (const paraText of paragraphTexts) {
    const normalizedPara = paraText.toLowerCase();
    if (normalizedPara.includes(normalizedTarget)) {
      // Found the paragraph containing the target
      if (replacement === '') {
        // Removal: remove the target text from the line, cleaning up commas
        let newText = paraText;
        // Try case-insensitive substring removal
        const idx = normalizedPara.indexOf(normalizedTarget);
        const actualMatch = paraText.substring(idx, idx + targetText.trim().length);

        // Remove with surrounding comma/space cleanup
        newText = paraText.replace(actualMatch, '');
        // Clean up double commas, leading/trailing commas after a colon, etc.
        newText = newText.replace(/,\s*,/g, ',');
        newText = newText.replace(/,\s*$/g, '');
        newText = newText.replace(/:\s*,\s*/g, ': ');
        newText = newText.replace(/\s{2,}/g, ' ');
        newText = newText.trim();

        logger.info('Resolved substring removal', {
          original: paraText.slice(0, 60),
          result: newText.slice(0, 60),
        });

        return { original: paraText, replacement: newText };
      } else {
        // Replacement: replace the target substring within the full line
        const idx = normalizedPara.indexOf(normalizedTarget);
        const actualMatch = paraText.substring(idx, idx + targetText.trim().length);
        const newText = paraText.replace(actualMatch, replacement);

        return { original: paraText, replacement: newText };
      }
    }
  }

  return null;
}

/**
 * Process an AI chat editing command.
 * Sends the instruction to Gemini, gets structured edits, applies them via DocxPatchEngine.
 */
export async function handleChatEdit(
  sessionId: string,
  instruction: string
): Promise<ChatEditResponse> {
  const session = getSession(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  logger.info('Processing AI chat edit', { sessionId, instructionLength: instruction.length });

  // Get the current resume text for context
  const generatedPath = getGeneratedFilePath(sessionId, session.fileType);
  let buffer: Buffer;

  if (fs.existsSync(generatedPath)) {
    buffer = fs.readFileSync(generatedPath);
  } else {
    buffer = readUploadedFile(session.filePath);
  }

  // Extract paragraph texts directly from DOCX XML for accurate matching
  const paragraphTexts = extractDocxParagraphTexts(buffer);

  // Also get HTML for AI context
  const html = await convertDocxToHtml(buffer);
  const plainText = html.replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Send to AI for interpretation
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const { env } = require('../config/env');

  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: env.geminiModel,
    systemInstruction: getEditSystemPrompt(),
  });

  const prompt = buildEditPrompt(instruction, plainText);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  });

  const responseText = result.response.text();
  logger.info('AI edit response received', { responseLength: responseText.length });

  let parsed: { edits: Array<{ action: string; targetText: string; replacement?: string; url?: string; sectionHint?: string }>; message: string; error: string | null };

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new AppError('AI returned invalid response for edit command.', 500, 'AI_PARSE_ERROR');
  }

  if (parsed.error) {
    return { appliedCount: 0, message: parsed.error, editsApplied: [] };
  }

  if (!parsed.edits || parsed.edits.length === 0) {
    return { appliedCount: 0, message: 'No edits were identified from your instruction.', editsApplied: [] };
  }

  // Apply text-based edits (replaceText, removeText) via DocxPatchEngine
  const textEdits: ManualEdit[] = [];
  const editsApplied: string[] = [];

  for (const edit of parsed.edits) {
    switch (edit.action) {
      case 'replaceText':
        if (edit.targetText && edit.replacement) {
          // Try direct match first; if too short, try substring resolution
          const resolved = resolveSubstringEdit(paragraphTexts, edit.targetText, edit.replacement);
          if (resolved) {
            textEdits.push(resolved);
          } else {
            textEdits.push({ original: edit.targetText, replacement: edit.replacement });
          }
          editsApplied.push(`Replaced "${edit.targetText.slice(0, 40)}" with "${edit.replacement.slice(0, 40)}"`);
        }
        break;
      case 'removeText':
        if (edit.targetText) {
          // Resolve the substring removal into a full paragraph-level edit
          const resolved = resolveSubstringEdit(paragraphTexts, edit.targetText, '');
          if (resolved) {
            textEdits.push(resolved);
            editsApplied.push(`Removed "${edit.targetText.slice(0, 50)}" from the document`);
          } else {
            // Fallback: try direct match
            textEdits.push({ original: edit.targetText, replacement: '' });
            editsApplied.push(`Removed "${edit.targetText.slice(0, 50)}"`);
          }
        }
        break;
      case 'bold':
      case 'unbold':
      case 'italic':
      case 'unitalic':
      case 'underline':
      case 'removeUnderline':
        editsApplied.push(`${edit.action}: "${edit.targetText?.slice(0, 50)}" — formatting changes are not supported`);
        break;
      case 'addHyperlink':
        editsApplied.push(`Add hyperlink to "${edit.targetText?.slice(0, 40)}" — hyperlinks are not supported`);
        break;
      default:
        editsApplied.push(`Unknown action: ${edit.action}`);
    }
  }

  let appliedCount = 0;

  if (textEdits.length > 0) {
    const editResult = await handleManualEdits(sessionId, textEdits);
    appliedCount = editResult.appliedCount;
  }

  // Build download URLs if changes were applied
  let downloadUrl: string | undefined;

  if (appliedCount > 0) {
    downloadUrl = `/api/resume/download/${sessionId}`;
  }

  return {
    appliedCount,
    message: parsed.message || `Processed ${parsed.edits.length} edit(s)`,
    editsApplied,
    downloadUrl,
  };
}
