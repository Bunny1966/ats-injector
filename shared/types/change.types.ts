// =============================================================================
// Change Types — AI recommendation and ATS analysis models
// =============================================================================
// These types represent the output of the AI engine. The Change Planner produces
// ChangeRecommendations; the ATS Analyzer produces ATSAnalysisResult.
// The user reviews these, and approved changes flow to the Patch Engine.
// =============================================================================

/**
 * The type of change being recommended by the AI.
 * - addition: New content to add (e.g., a missing skill)
 * - modification: Edit existing content (e.g., improve a bullet point)
 * - removal: Suggest removing content (requires explicit user approval)
 */
export type ChangeType = 'addition' | 'modification' | 'removal';

/**
 * Confidence level for a recommendation.
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Expected ATS impact of applying this change.
 */
export type ATSImpactLevel = 'high' | 'medium' | 'low';

/**
 * Category of the change for grouping and filtering.
 */
export type ChangeCategory =
  | 'keyword'       // Missing ATS keyword injection
  | 'wording'       // Improving weak wording
  | 'grammar'       // Grammar/spelling fix
  | 'skill'         // Adding/modifying skills
  | 'description'   // Improving bullet points / descriptions
  | 'formatting';   // Formatting improvements

/**
 * User's decision on a change recommendation.
 */
export type ChangeStatus = 'pending' | 'approved' | 'rejected';

/**
 * A single change recommendation from the AI.
 * Each recommendation targets a specific content element in the resume.
 */
export interface ChangeRecommendation {
  /** Unique identifier for this change. */
  id: string;

  /** The type of change (add, modify, or remove). */
  type: ChangeType;

  /** ID of the target SectionContent element. */
  targetId: string;

  /** ID of the parent ResumeSection. */
  sectionId: string;

  /** The section title for display purposes. */
  sectionTitle: string;

  /** Current text content (for modifications and removals). */
  original?: string;

  /** Proposed new text (for additions and modifications). */
  proposed: string;

  /** Human-readable reason for this recommendation. */
  reason: string;

  /** AI confidence in this recommendation. */
  confidence: ConfidenceLevel;

  /** Expected improvement to ATS score if applied. */
  atsImpact: ATSImpactLevel;

  /** Category for grouping similar changes. */
  category: ChangeCategory;

  /** Job description keywords this change addresses. */
  matchedKeywords?: string[];

  /** User's current decision (default: pending). */
  status: ChangeStatus;
}

/**
 * A weak bullet point identified during ATS analysis.
 */
export interface WeakBulletPoint {
  /** ID of the content element containing the weak bullet. */
  id: string;
  /** The text of the weak bullet point. */
  text: string;
  /** Explanation of why this bullet is weak. */
  reason: string;
  /** The section this bullet belongs to. */
  sectionTitle: string;
}

/**
 * A duplicate skill found in the resume.
 */
export interface DuplicateSkill {
  /** The duplicated skill name. */
  skill: string;
  /** Locations (section titles) where it appears. */
  locations: string[];
}

/**
 * An opportunity to add a keyword from the job description.
 */
export interface KeywordOpportunity {
  /** The keyword from the JD. */
  keyword: string;
  /** Suggested section/location to add it. */
  suggestedLocation: string;
  /** Relevance score (0-100). */
  relevance: number;
}

/**
 * Complete ATS analysis result comparing resume against job description.
 */
export interface ATSAnalysisResult {
  /** Overall ATS compatibility score (0-100). */
  overallScore: number;

  /** Keywords from the JD that already exist in the resume. */
  matchedKeywords: string[];

  /** Keywords from the JD missing from the resume. */
  missingKeywords: string[];

  /** Skills required by the JD but not found in the resume. */
  missingSkills: string[];

  /** Frameworks/tools required by the JD but not in the resume. */
  missingFrameworks: string[];

  /** Bullet points identified as weak or non-impactful. */
  weakBulletPoints: WeakBulletPoint[];

  /** Skills that appear multiple times in the resume. */
  duplicateSkills: DuplicateSkill[];

  /** Opportunities to strategically place JD keywords. */
  keywordOpportunities: KeywordOpportunity[];

  /** Short job title abbreviation (2-5 letters) inferred from the JD (e.g., SDE, QA, HR). */
  jobTitleAbbreviation?: string;
}

/**
 * The complete optimization result combining analysis and changes.
 */
export interface OptimizationResult {
  /** ATS analysis comparing resume vs job description. */
  analysis: ATSAnalysisResult;

  /** Ordered list of change recommendations for user review. */
  changes: ChangeRecommendation[];

  /** Projected ATS score if all changes are approved. */
  projectedScore: number;

  /** AI model that generated these results. */
  modelUsed: string;

  /** ISO timestamp of when analysis completed. */
  analyzedAt: string;
}
