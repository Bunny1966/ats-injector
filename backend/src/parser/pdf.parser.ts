// =============================================================================
// PDF Parser — Text extraction with coordinates
// =============================================================================
// Uses pdf-parse for text extraction. For the MVP, we extract text content
// and use heuristics to group into sections. Coordinates are approximated
// via line ordering since pdf-parse gives us page-level text.
// =============================================================================

const { PDFParse } = require('pdf-parse');
import type {
  StructuredResume,
  ResumeSection,
  SectionContent,
  SourceReference,
} from '@resume-optimizer/shared';
import { generateSectionId, generateContentId } from '../utils/id';
import { classifySection, looksLikeHeading } from './section-detector';
import { logger } from '../utils/logger';
import type { DocumentParser } from './types';

/**
 * Parsed line from PDF text extraction.
 */
interface PdfLine {
  text: string;
  pageIndex: number;
  lineIndex: number;
}

export class PdfParser implements DocumentParser {
  readonly fileType = 'pdf' as const;

  async parse(buffer: Buffer, fileName: string, sessionId: string): Promise<StructuredResume> {
    logger.info('PDF Parser: starting', { fileName });

    // Parse the PDF using pdf-parse v2 class-based API
    const pdf = new PDFParse({ data: buffer });
    const textResult = await pdf.getText();
    const infoResult = await pdf.getInfo();
    const numPages = infoResult.total;

    // Split text into lines and pages
    const lines = this.extractLines(textResult.text, numPages);

    // Group lines into sections
    const sections = this.groupIntoSections(lines);

    logger.info('PDF Parser: complete', {
      fileName,
      pages: numPages,
      sections: sections.length,
      totalLines: lines.length,
    });

    return {
      metadata: {
        fileName,
        fileType: 'pdf',
        pageCount: numPages,
        parsedAt: new Date().toISOString(),
        sessionId,
      },
      sections,
    };
  }

  /**
   * Extract lines from PDF text output.
   * pdf-parse gives us the full text with page breaks as form feeds (\f).
   */
  private extractLines(rawText: string, numPages: number): PdfLine[] {
    const lines: PdfLine[] = [];

    // Split by page (form feed character)
    const pages = rawText.split('\f');

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = pages[pageIdx];
      const pageLines = pageText.split('\n');

      for (let lineIdx = 0; lineIdx < pageLines.length; lineIdx++) {
        const text = pageLines[lineIdx].trim();
        if (text.length > 0) {
          lines.push({ text, pageIndex: pageIdx, lineIndex: lineIdx });
        }
      }
    }

    return lines;
  }

  /**
   * Group lines into semantic sections.
   * Uses all-caps detection and known section patterns.
   */
  private groupIntoSections(lines: PdfLine[]): ResumeSection[] {
    const sections: ResumeSection[] = [];
    let currentSection: ResumeSection | null = null;
    let sectionOrder = 0;
    let foundFirstSection = false;

    for (const line of lines) {
      const isHeading = looksLikeHeading(line.text);
      const sectionType = classifySection(line.text);
      const isRecognizedSection = sectionType !== 'custom';

      const sourceRef: SourceReference = {
        type: 'pdf-coords',
        pageIndex: line.pageIndex,
        x: 0,
        y: line.lineIndex * 14, // Approximate y position
      };

      if (isHeading && isRecognizedSection) {
        foundFirstSection = true;
        currentSection = {
          id: generateSectionId(),
          type: sectionType,
          title: line.text,
          order: sectionOrder++,
          content: [],
        };
        sections.push(currentSection);
      } else if (!foundFirstSection) {
        // Content before first recognized heading → header
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
        currentSection.content.push(this.lineToContent(line, sourceRef));
      } else if (isHeading && !isRecognizedSection) {
        // Unknown heading → custom section
        currentSection = {
          id: generateSectionId(),
          type: 'custom',
          title: line.text,
          order: sectionOrder++,
          content: [],
        };
        sections.push(currentSection);
      } else {
        // Regular content
        if (!currentSection) {
          currentSection = {
            id: generateSectionId(),
            type: 'header',
            title: 'Header',
            order: sectionOrder++,
            content: [],
          };
          sections.push(currentSection);
        }

        // Detect bullet points
        const content = this.lineToContent(line, sourceRef);
        if (/^[•●○◦▪▸\-–—\*]\s/.test(line.text)) {
          content.type = 'bullet';
          content.text = line.text.replace(/^[•●○◦▪▸\-–—\*]\s*/, '');
        }

        currentSection.content.push(content);
      }
    }

    return sections;
  }

  /**
   * Convert a PDF line to a SectionContent element.
   */
  private lineToContent(line: PdfLine, sourceRef: SourceReference): SectionContent {
    return {
      id: generateContentId(),
      type: 'text',
      text: line.text,
      sourceRef,
    };
  }
}
