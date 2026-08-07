// =============================================================================
// Section Detection Utilities
// =============================================================================
// Heuristics to classify resume section headings into semantic types.
// This is shared between DOCX and PDF parsers.
// =============================================================================

import type { SectionType } from '@resume-optimizer/shared';

/**
 * Map of keywords/patterns to section types.
 * Order matters — first match wins.
 */
const SECTION_PATTERNS: Array<{ type: SectionType; patterns: RegExp[] }> = [
  {
    type: 'summary',
    patterns: [
      /\b(summary|profile|about\s*me|professional\s*summary|executive\s*summary|career\s*summary|overview)\b/i,
    ],
  },
  {
    type: 'objective',
    patterns: [/\b(objective|career\s*objective|job\s*objective)\b/i],
  },
  {
    type: 'experience',
    patterns: [
      /\b(experience|work\s*experience|professional\s*experience|employment|work\s*history|career\s*history)\b/i,
    ],
  },
  {
    type: 'education',
    patterns: [/\b(education|academic|qualification|degree|university|college)\b/i],
  },
  {
    type: 'skills',
    patterns: [
      /\b(skills|technical\s*skills|core\s*competencies|competencies|technologies|tech\s*stack|tools|expertise)\b/i,
    ],
  },
  {
    type: 'projects',
    patterns: [/\b(projects|personal\s*projects|academic\s*projects|key\s*projects)\b/i],
  },
  {
    type: 'certifications',
    patterns: [/\b(certifications?|licenses?|accreditations?)\b/i],
  },
  {
    type: 'awards',
    patterns: [/\b(awards?|honors?|achievements?|recognition)\b/i],
  },
  {
    type: 'publications',
    patterns: [/\b(publications?|papers?|research)\b/i],
  },
  {
    type: 'volunteer',
    patterns: [/\b(volunteer|volunteering|community\s*service|social\s*work)\b/i],
  },
  {
    type: 'languages',
    patterns: [/\b(languages?|linguistic)\b/i],
  },
  {
    type: 'interests',
    patterns: [/\b(interests?|hobbies|activities|extracurricular)\b/i],
  },
  {
    type: 'references',
    patterns: [/\b(references?)\b/i],
  },
];

/**
 * Classify a heading text into a SectionType.
 * Returns 'custom' if no pattern matches.
 */
export function classifySection(headingText: string): SectionType {
  const cleaned = headingText.trim();
  if (!cleaned) return 'custom';

  for (const { type, patterns } of SECTION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(cleaned)) {
        return type;
      }
    }
  }

  return 'custom';
}

/**
 * Determine if text looks like a section heading based on formatting cues.
 * Used when style-based detection isn't available (e.g., PDFs).
 */
export function looksLikeHeading(
  text: string,
  opts?: { isBold?: boolean; fontSize?: number; averageFontSize?: number }
): boolean {
  const trimmed = text.trim();

  // Too long to be a heading
  if (trimmed.length > 80) return false;

  // Empty
  if (trimmed.length === 0) return false;

  // All caps and short — very likely a heading
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 2 && trimmed.length < 50) {
    // But not if it's a single word like "AND" or "OR"
    if (trimmed.split(/\s+/).length >= 1 && /[A-Z]/.test(trimmed)) {
      return true;
    }
  }

  // Bold + short text
  if (opts?.isBold && trimmed.length < 50) {
    return true;
  }

  // Significantly larger font
  if (opts?.fontSize && opts?.averageFontSize) {
    if (opts.fontSize >= opts.averageFontSize * 1.3) {
      return true;
    }
  }

  // Matches a known section pattern
  if (classifySection(trimmed) !== 'custom') {
    return true;
  }

  return false;
}
