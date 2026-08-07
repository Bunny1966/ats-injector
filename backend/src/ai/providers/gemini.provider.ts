// =============================================================================
// Gemini AI Provider
// =============================================================================
// Implements the AIProvider interface using Google's Gemini API.
// Uses structured JSON output via responseSchema for reliable parsing.
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StructuredResume, ChangeRecommendation, ATSAnalysisResult, OptimizationMode } from '@resume-optimizer/shared';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { generateChangeId } from '../../utils/id';
import { getSystemPrompt, buildAnalysisPrompt, formatResumeForAI } from '../prompts';
import type { AIProvider, AIAnalysisResult } from './base.provider';

export class GeminiProvider implements AIProvider {
  readonly name = 'Google Gemini';
  readonly model: string;
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!env.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set. Cannot initialize Gemini provider.');
    }
    this.model = env.geminiModel;
    this.genAI = new GoogleGenerativeAI(env.geminiApiKey);
    logger.info('Gemini provider initialized', { model: this.model });
  }

  async analyze(
    resume: StructuredResume,
    jobDescription: string,
    mode: OptimizationMode = 'quick'
  ): Promise<AIAnalysisResult> {
    logger.info('Gemini: starting analysis', {
      model: this.model,
      mode,
      sections: resume.sections.length,
      jdLength: jobDescription.length,
    });

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: getSystemPrompt(mode),
    });

    // Format the resume for AI consumption
    const resumeText = formatResumeForAI(resume.sections);
    const prompt = buildAnalysisPrompt(resumeText, jobDescription, mode);

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 16384,
        },
      });

      const response = result.response;
      const text = response.text();

      logger.info('Gemini: response received', {
        responseLength: text.length,
      });

      // Parse the JSON response
      const parsed = this.parseResponse(text);

      // Assign unique IDs and default status to each change
      const changes: ChangeRecommendation[] = (
        (parsed.changes as Array<Partial<ChangeRecommendation>>) || []
      ).map((change) => ({
        id: generateChangeId(),
        type: change.type || 'modification',
        targetId: change.targetId || '',
        sectionId: change.sectionId || '',
        sectionTitle: change.sectionTitle || '',
        original: change.original,
        proposed: change.proposed || '',
        reason: change.reason || '',
        confidence: change.confidence || 'medium',
        atsImpact: change.atsImpact || 'medium',
        category: change.category || 'keyword',
        matchedKeywords: change.matchedKeywords || [],
        status: 'pending' as const,
      }));

      const analysisData = parsed.analysis as Record<string, unknown> | undefined;

      const analysis: ATSAnalysisResult = {
        overallScore: (analysisData?.overallScore as number) || 0,
        matchedKeywords: (analysisData?.matchedKeywords as string[]) || [],
        missingKeywords: (analysisData?.missingKeywords as string[]) || [],
        missingSkills: (analysisData?.missingSkills as string[]) || [],
        missingFrameworks: (analysisData?.missingFrameworks as string[]) || [],
        weakBulletPoints: (analysisData?.weakBulletPoints as ATSAnalysisResult['weakBulletPoints']) || [],
        duplicateSkills: (analysisData?.duplicateSkills as ATSAnalysisResult['duplicateSkills']) || [],
        keywordOpportunities: (analysisData?.keywordOpportunities as ATSAnalysisResult['keywordOpportunities']) || [],
        jobTitleAbbreviation: analysisData?.jobTitleAbbreviation as string | undefined,
      };

      return {
        analysis,
        changes,
        projectedScore: (parsed.projectedScore as number) || analysis.overallScore + 10,
        modelUsed: this.model,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Gemini: analysis failed', { error: errorMsg });
      throw new Error(`Gemini analysis failed: ${errorMsg}`);
    }
  }

  /**
   * Parse the AI's JSON response, handling potential formatting issues.
   */
  private parseResponse(text: string): Record<string, unknown> {
    const cleaned = text.trim();
    const firstBrace = cleaned.indexOf('{');
    
    if (firstBrace === -1) {
      throw new Error('AI returned invalid response. No JSON object found.');
    }

    // Use a brace-counting approach to find the exact end of the first JSON object
    let braces = 0;
    let inString = false;
    let escape = false;
    let endIndex = -1;

    for (let i = firstBrace; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (char === '\\') {
          escape = true;
        } else if (char === '"') {
          inString = false;
        }
      } else {
        if (char === '"') {
          inString = true;
        } else if (char === '{') {
          braces++;
        } else if (char === '}') {
          braces--;
          if (braces === 0) {
            endIndex = i;
            break;
          }
        }
      }
    }

    if (endIndex === -1) {
      logger.error('Gemini: failed to find closing brace for JSON response', {
        responsePreview: cleaned.slice(0, 500),
      });
      throw new Error('AI returned incomplete JSON. Please try again.');
    }

    const jsonString = cleaned.substring(firstBrace, endIndex + 1);

    try {
      return JSON.parse(jsonString);
    } catch (e) {
      logger.error('Gemini: failed to parse JSON response', {
        error: String(e),
        responsePreview: jsonString.slice(0, 500),
      });
      throw new Error('AI returned invalid JSON. Please try again.');
    }
  }
}