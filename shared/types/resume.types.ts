// =============================================================================
// Resume Types — Core data model for the AI Resume Optimizer
// =============================================================================
// These types represent the structured understanding of a resume document.
// The parser produces this model; the AI analyzes it; the patch engine consumes it.
// =============================================================================

/**
 * Supported file formats for resume upload.
 */
export type FileType = 'pdf' | 'docx';

/**
 * Semantic section types recognized in a resume.
 * 'custom' is used for sections that don't match any known pattern.
 */
export type SectionType =
  | 'header'
  | 'summary'
  | 'objective'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'awards'
  | 'publications'
  | 'volunteer'
  | 'languages'
  | 'interests'
  | 'references'
  | 'custom';

/**
 * Content element types within a resume section.
 */
export type ContentType =
  | 'text'
  | 'bullet'
  | 'heading'
  | 'subheading'
  | 'skill-group'
  | 'date-range'
  | 'link'
  | 'divider'
  | 'table-row'
  | 'list-item';

/**
 * Reference to the source location in the original document.
 * Used by the patch engine to locate exactly where to apply changes.
 */
export interface SourceReference {
  /** The type of source reference, determined by the file format. */
  type: 'docx-xpath' | 'pdf-coords';

  /** XPath-like path to the XML element (DOCX only). */
  path?: string;

  /** Index of the XML element in the document body (DOCX only). */
  xmlElementIndex?: number;

  /** Index of the run element within a paragraph (DOCX only). */
  runIndex?: number;

  /** Page number, 0-indexed (PDF only). */
  pageIndex?: number;

  /** X coordinate in PDF units (PDF only). */
  x?: number;

  /** Y coordinate in PDF units (PDF only). */
  y?: number;

  /** Width of the text block in PDF units (PDF only). */
  width?: number;

  /** Height of the text block in PDF units (PDF only). */
  height?: number;

  /** Font name used at this location (for patch engine to match). */
  fontName?: string;

  /** Font size used at this location (for patch engine to match). */
  fontSize?: number;
}

/**
 * Formatting metadata for a content element.
 * Captures the visual properties without modifying them.
 */
export interface ContentMetadata {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  hyperlink?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  level?: number; // Heading level (1-6)
}

/**
 * A single content element within a resume section.
 * This is the atomic unit that the AI can suggest changes to.
 */
export interface SectionContent {
  /** Unique identifier used for referencing in change recommendations. */
  id: string;

  /** The semantic type of this content element. */
  type: ContentType;

  /** The actual text content (plain text, no formatting markup). */
  text: string;

  /** Nested content elements (e.g., bullet points under a job title). */
  children?: SectionContent[];

  /** Visual formatting metadata (read-only, for context). */
  metadata?: ContentMetadata;

  /** Location reference back to the original document for patching. */
  sourceRef: SourceReference;
}

/**
 * A top-level section in the resume (e.g., "Experience", "Skills").
 */
export interface ResumeSection {
  /** Unique identifier for this section. */
  id: string;

  /** The semantic type of this section. */
  type: SectionType;

  /** The original section heading text (e.g., "Work Experience"). */
  title: string;

  /** Position order in the document (0-indexed). */
  order: number;

  /** All content elements within this section. */
  content: SectionContent[];
}

/**
 * The complete structured representation of a parsed resume.
 * This is the primary data model that flows through the entire system.
 */
export interface StructuredResume {
  /** Document metadata. */
  metadata: {
    /** Original file name. */
    fileName: string;
    /** File format (pdf or docx). */
    fileType: FileType;
    /** Number of pages in the document. */
    pageCount: number;
    /** ISO timestamp when parsing completed. */
    parsedAt: string;
    /** Unique session ID for this upload. */
    sessionId: string;
  };

  /** All identified sections in document order. */
  sections: ResumeSection[];
}
