// =============================================================================
// DOCX Parser — OpenXML Direct Traversal
// =============================================================================
// Parses DOCX files by directly reading the OpenXML structure via PizZip.
// This approach preserves ALL formatting metadata since we never convert
// to an intermediate format like HTML.
//
// DOCX structure: ZIP archive containing word/document.xml (main content)
// The XML uses the WordprocessingML schema (w: namespace).
// =============================================================================

import PizZip from 'pizzip';
import { parseStringPromise } from 'xml2js';
import type {
  StructuredResume,
  ResumeSection,
  SectionContent,
  ContentType,
  ContentMetadata,
  SourceReference,
} from '@resume-optimizer/shared';
import { generateSectionId, generateContentId } from '../utils/id';
import { classifySection, looksLikeHeading } from './section-detector';
import { logger } from '../utils/logger';
import type { DocumentParser } from './types';

// XML namespace prefixes used in DOCX
const W = 'w:';

/**
 * Strip null bytes and other invisible control characters from text.
 * DOCX files from certain editors embed these, and they break JSON
 * serialization when the AI echoes them back.
 */
function sanitizeText(text: string): string {
  // Remove null bytes, and control chars except tab(\t), newline(\n), carriage return(\r)
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0) continue; // null byte
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue; // other control chars
    result += text[i];
  }
  return result;
}

/**
 * Extract text from a run element (w:r).
 * A "run" is the smallest formatting unit in a DOCX paragraph.
 */
function extractRunText(run: Record<string, unknown>): string {
  const parts: string[] = [];

  // w:t — regular text
  const textElements = run[`${W}t`];
  if (Array.isArray(textElements)) {
    for (const t of textElements) {
      if (typeof t === 'string') {
        parts.push(t);
      } else if (typeof t === 'object' && t !== null && '_' in t) {
        parts.push(String((t as Record<string, unknown>)['_']));
      }
    }
  } else if (typeof textElements === 'string') {
    parts.push(textElements);
  } else if (typeof textElements === 'object' && textElements !== null && '_' in textElements) {
    parts.push(String((textElements as Record<string, unknown>)['_']));
  }

  // w:tab — tab character
  if (run[`${W}tab`]) {
    parts.push('\t');
  }

  return sanitizeText(parts.join(''));
}

/**
 * Extract formatting metadata from a run's properties (w:rPr).
 */
function extractRunMetadata(runProps: Record<string, unknown> | undefined): ContentMetadata {
  const meta: ContentMetadata = {};
  if (!runProps) return meta;

  if (runProps[`${W}b`] !== undefined) meta.bold = true;
  if (runProps[`${W}i`] !== undefined) meta.italic = true;
  if (runProps[`${W}u`] !== undefined) meta.underline = true;
  if (runProps[`${W}strike`] !== undefined) meta.strikethrough = true;

  // Font size (w:sz is in half-points)
  const sz = runProps[`${W}sz`] as Record<string, unknown> | undefined;
  if (sz && sz['$'] && typeof (sz['$'] as Record<string, unknown>)[`${W}val`] === 'string') {
    meta.fontSize = parseInt((sz['$'] as Record<string, unknown>)[`${W}val`] as string, 10) / 2;
  }

  // Font family
  const rFonts = runProps[`${W}rFonts`] as Record<string, unknown> | undefined;
  if (rFonts && rFonts['$']) {
    const attrs = rFonts['$'] as Record<string, string>;
    meta.fontFamily = attrs[`${W}ascii`] || attrs[`${W}hAnsi`] || attrs[`${W}cs`];
  }

  // Color
  const color = runProps[`${W}color`] as Record<string, unknown> | undefined;
  if (color && color['$'] && typeof (color['$'] as Record<string, unknown>)[`${W}val`] === 'string') {
    meta.color = `#${(color['$'] as Record<string, unknown>)[`${W}val`]}`;
  }

  return meta;
}

/**
 * Extract hyperlink URL from a relationship ID.
 */
function resolveHyperlink(
  relId: string,
  relationships: Map<string, string>
): string | undefined {
  return relationships.get(relId);
}

/**
 * Extract text from a raw paragraph XML string in exact document order.
 * This uses the same regex approach as the patch engine, ensuring the AI
 * sees text in the same order that the patch engine will search for it.
 */
function extractTextFromRawXml(rawXml: string): string {
  const textRegex = /<w:t(?:>| [^>]*>)([\s\S]*?)<\/w:t>/g;
  let fullText = '';
  let m;
  while ((m = textRegex.exec(rawXml)) !== null) {
    fullText += m[1];
  }
  return fullText;
}

/**
 * Parse a single paragraph element (w:p) into SectionContent.
 * @param rawXml - The raw XML string of this paragraph, used for
 *   document-order text extraction that matches the patch engine.
 */
function parseParagraph(
  para: Record<string, unknown>,
  paraIndex: number,
  relationships: Map<string, string>,
  rawXml?: string
): { content: SectionContent; isBold: boolean; fontSize: number | undefined } {
  const runs = (para[`${W}r`] || []) as Record<string, unknown>[];
  const hyperlinks = (para[`${W}hyperlink`] || []) as Record<string, unknown>[];
  const paraProps = para[`${W}pPr`] as Record<string, unknown>[] | undefined;

  let fullText = '';
  let combinedMeta: ContentMetadata = {};
  let isBold = false;
  let fontSize: number | undefined;
  let contentType: ContentType = 'text';

  // Check paragraph-level properties
  if (paraProps && paraProps[0]) {
    const pPr = paraProps[0];

    // Check for list/bullet (w:numPr)
    if (pPr[`${W}numPr`]) {
      contentType = 'bullet';
    }

    // Paragraph style (w:pStyle)
    const pStyle = pPr[`${W}pStyle`] as Record<string, unknown>[] | undefined;
    if (pStyle && pStyle[0] && (pStyle[0] as Record<string, unknown>)['$']) {
      const styleVal = ((pStyle[0] as Record<string, unknown>)['$'] as Record<string, string>)[`${W}val`] || '';
      if (/heading/i.test(styleVal) || /title/i.test(styleVal)) {
        contentType = 'heading';
      }
    }

    // Alignment
    const jc = pPr[`${W}jc`] as Record<string, unknown>[] | undefined;
    if (jc && jc[0] && (jc[0] as Record<string, unknown>)['$']) {
      const alignment = ((jc[0] as Record<string, unknown>)['$'] as Record<string, string>)[`${W}val`];
      if (alignment === 'center' || alignment === 'right' || alignment === 'both') {
        combinedMeta.alignment = alignment === 'both' ? 'justify' : alignment;
      }
    }
  }

  // Extract text in document order from raw XML (runs + hyperlinks interleaved correctly)
  // This ensures the AI sees text in the exact same order as the patch engine.
  if (rawXml) {
    fullText = extractTextFromRawXml(rawXml);
  } else {
    // Fallback: use parsed object (runs first, then hyperlinks)
    for (const run of runs) {
      fullText += extractRunText(run);
    }
    for (const hl of hyperlinks) {
      const hlRuns = (hl[`${W}r`] || []) as Record<string, unknown>[];
      for (const run of hlRuns) {
        fullText += extractRunText(run);
      }
    }
  }

  // Extract formatting metadata from the first run (unchanged)
  for (let ri = 0; ri < runs.length; ri++) {
    const run = runs[ri];
    const rPr = (run[`${W}rPr`] as Record<string, unknown>[] | undefined)?.[0];
    const runMeta = extractRunMetadata(rPr);
    if (ri === 0) {
      combinedMeta = { ...combinedMeta, ...runMeta };
      isBold = !!runMeta.bold;
      fontSize = runMeta.fontSize;
    }
  }

  // Extract hyperlink targets (unchanged)
  for (const hl of hyperlinks) {
    const hlAttrs = hl['$'] as Record<string, string> | undefined;
    if (hlAttrs) {
      const relId = hlAttrs[`r:id`];
      if (relId) {
        combinedMeta.hyperlink = resolveHyperlink(relId, relationships);
      }
    }
  }

  const sourceRef: SourceReference = {
    type: 'docx-xpath',
    path: `w:body/w:p[${paraIndex}]`,
    xmlElementIndex: paraIndex,
  };

  return {
    content: {
      id: generateContentId(),
      type: contentType,
      text: sanitizeText(fullText).trim(),
      metadata: Object.keys(combinedMeta).length > 0 ? combinedMeta : undefined,
      sourceRef,
    },
    isBold,
    fontSize,
  };
}

/**
 * Parse relationship file to get hyperlink targets.
 */
async function parseRelationships(zip: PizZip): Promise<Map<string, string>> {
  const rels = new Map<string, string>();
  try {
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (!relsFile) return rels;

    const relsXml = relsFile.asText();
    const parsed = await parseStringPromise(relsXml);
    const relationships = parsed?.Relationships?.Relationship || [];

    for (const rel of relationships) {
      const attrs = rel['$'];
      if (attrs?.Id && attrs?.Target) {
        rels.set(attrs.Id, attrs.Target);
      }
    }
  } catch (e) {
    logger.warn('Failed to parse DOCX relationships', { error: String(e) });
  }
  return rels;
}

export class DocxParser implements DocumentParser {
  readonly fileType = 'docx' as const;

  async parse(buffer: Buffer, fileName: string, sessionId: string): Promise<StructuredResume> {
    logger.info('DOCX Parser: starting', { fileName });

    // 1. Unzip the DOCX
    const zip = new PizZip(buffer);

    // 2. Read document.xml (main content)
    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      throw new Error('Invalid DOCX file: missing word/document.xml');
    }
    const docXml = docFile.asText();

    // 3. Parse XML into JS object
    const parsed = await parseStringPromise(docXml);

    // 4. Parse relationships for hyperlinks
    const relationships = await parseRelationships(zip);

    // 5. Get the body element
    const body = parsed?.[`${W}document`]?.[`${W}body`]?.[0];
    if (!body) {
      throw new Error('Invalid DOCX structure: missing body element');
    }

    // 6. Extract all paragraphs (parsed objects)
    const paragraphs = (body[`${W}p`] || []) as Record<string, unknown>[];

    // 6b. Extract raw paragraph XML strings for document-order text extraction.
    //     This uses the same regex as the patch engine so the AI sees text in
    //     the exact same order the patch engine will search for it.
    const rawParagraphs: string[] = [];
    const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
    let pMatch;
    while ((pMatch = paraRegex.exec(docXml)) !== null) {
      rawParagraphs.push(pMatch[0]);
    }

    // 7. Parse each paragraph
    const parsedParagraphs: Array<{
      content: SectionContent;
      isBold: boolean;
      fontSize: number | undefined;
    }> = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const result = parseParagraph(paragraphs[i], i, relationships, rawParagraphs[i]);
      if (result.content.text.length > 0) {
        parsedParagraphs.push(result);
      }
    }

    // 8. Group paragraphs into sections
    const sections = this.groupIntoSections(parsedParagraphs);

    logger.info('DOCX Parser: complete', {
      fileName,
      sections: sections.length,
      totalElements: parsedParagraphs.length,
    });

    return {
      metadata: {
        fileName,
        fileType: 'docx',
        pageCount: 1, // DOCX doesn't have page info without rendering
        parsedAt: new Date().toISOString(),
        sessionId,
      },
      sections,
    };
  }

  /**
   * Group parsed paragraphs into semantic sections.
   * Uses heading detection and section classification.
   */
  private groupIntoSections(
    paragraphs: Array<{
      content: SectionContent;
      isBold: boolean;
      fontSize: number | undefined;
    }>
  ): ResumeSection[] {
    const sections: ResumeSection[] = [];
    let currentSection: ResumeSection | null = null;
    let sectionOrder = 0;

    // Calculate average font size for heading detection
    const fontSizes = paragraphs
      .filter((p) => p.fontSize !== undefined)
      .map((p) => p.fontSize!);
    const avgFontSize =
      fontSizes.length > 0
        ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length
        : 11;

    // First few paragraphs before any heading → 'header' section
    let foundFirstHeading = false;

    for (const para of paragraphs) {
      const isHeading =
        para.content.type === 'heading' ||
        looksLikeHeading(para.content.text, {
          isBold: para.isBold,
          fontSize: para.fontSize,
          averageFontSize: avgFontSize,
        });

      if (isHeading && classifySection(para.content.text) !== 'custom') {
        // Start a new section
        foundFirstHeading = true;
        const sectionType = classifySection(para.content.text);

        currentSection = {
          id: generateSectionId(),
          type: sectionType,
          title: para.content.text,
          order: sectionOrder++,
          content: [],
        };
        sections.push(currentSection);
      } else if (isHeading && !foundFirstHeading) {
        // Before any recognized section — treat as header
        if (!currentSection || currentSection.type !== 'header') {
          currentSection = {
            id: generateSectionId(),
            type: 'header',
            title: 'Header',
            order: sectionOrder++,
            content: [],
          };
          sections.push(currentSection);
        }
        currentSection.content.push(para.content);
      } else if (isHeading) {
        // Unknown heading → custom section
        currentSection = {
          id: generateSectionId(),
          type: 'custom',
          title: para.content.text,
          order: sectionOrder++,
          content: [],
        };
        sections.push(currentSection);
      } else {
        // Regular content — add to current section
        if (!currentSection) {
          // No section yet → header
          currentSection = {
            id: generateSectionId(),
            type: 'header',
            title: 'Header',
            order: sectionOrder++,
            content: [],
          };
          sections.push(currentSection);
        }
        currentSection.content.push(para.content);
      }
    }

    return sections;
  }
}
