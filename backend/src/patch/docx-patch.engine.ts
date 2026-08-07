// =============================================================================
// DOCX Patch Engine — In-place XML text replacement
// =============================================================================
// Surgically replaces text within the DOCX XML structure (word/document.xml)
// while preserving ALL formatting (fonts, sizes, colors, bold, spacing, etc.)
//
// Strategy:
// - Unzip the DOCX (it's a ZIP archive)
// - Parse word/document.xml
// - For each approved change, find the `original` text across XML runs
//   and replace it with the `proposed` text
// - For additions, append text at the end of the target section
// - Re-zip to produce the patched DOCX
//
// This is like a human editing text in Word — only the words change.
// =============================================================================

import PizZip from 'pizzip';
import { logger } from '../utils/logger';
import type { ChangeRecommendation, ChangeDecision } from '@resume-optimizer/shared';
import type { PatchEngine, PatchResult } from './types';

export class DocxPatchEngine implements PatchEngine {
  async apply(
    originalBuffer: Buffer,
    changes: ChangeRecommendation[],
    decisions: ChangeDecision[]
  ): Promise<PatchResult> {
    // Build a decision map: changeId → status
    const decisionMap = new Map<string, 'approved' | 'rejected'>();
    const editedProposedMap = new Map<string, string>();
    decisions.forEach((d) => {
      decisionMap.set(d.changeId, d.status);
      if (d.editedProposed !== undefined) {
        editedProposedMap.set(d.changeId, d.editedProposed);
      }
    });

    // Separate approved vs rejected changes, applying user edits to proposed text
    const approvedChanges = changes
      .filter((c) => decisionMap.get(c.id) === 'approved')
      .map((c) => {
        const userEdit = editedProposedMap.get(c.id);
        if (userEdit !== undefined) {
          return { ...c, proposed: userEdit };
        }
        return c;
      });
    const rejectedCount = changes.filter(
      (c) => decisionMap.get(c.id) === 'rejected'
    ).length;

    if (approvedChanges.length === 0) {
      return {
        buffer: originalBuffer,
        appliedCount: 0,
        rejectedCount,
        failedCount: 0,
        appliedChanges: [],
      };
    }

    // Unzip the DOCX
    const zip = new PizZip(originalBuffer);
    const docXml = zip.file('word/document.xml');

    if (!docXml) {
      throw new Error('Invalid DOCX: word/document.xml not found');
    }

    let xmlContent = docXml.asText();
    const appliedChanges: string[] = [];
    let failedCount = 0;

    // Process each approved change
    for (const change of approvedChanges) {
      try {
        if (change.type === 'modification' && change.original) {
          // MODIFICATION: Find and replace original text with proposed
          // Strip bullet prefixes — the AI often includes • from our prompt formatting,
          // but DOCX renders bullets via <w:numPr> not as text characters.
          let originalText = this.stripBulletPrefix(change.original);
          let proposedText = this.stripBulletPrefix(change.proposed);

          // Safety net: If AI proposed text is significantly longer than original,
          // trim it to prevent layout shifts (content pushing to next page).
          // We disable this for manual edits since the user is in direct control.
          if (change.reason !== 'Manual edit') {
            const lengthDiff = proposedText.length - originalText.length;
            if (lengthDiff > 15) {
              logger.warn('DOCX Patch: proposed text too long, trimming to word boundary', {
                section: change.sectionTitle,
                originalLen: originalText.length,
                proposedLen: proposedText.length,
                diff: lengthDiff,
              });
              // Trim to the last complete word that fits within the original length + small buffer
              const maxLen = originalText.length + 10;
              if (proposedText.length > maxLen) {
                let trimmed = proposedText.substring(0, maxLen);
                // Find the last space to avoid cutting a word in half
                const lastSpace = trimmed.lastIndexOf(' ');
                if (lastSpace > maxLen * 0.7) {
                  trimmed = trimmed.substring(0, lastSpace);
                }
                proposedText = trimmed;
              }
            }
          }

          const result = this.replaceTextInXml(
            xmlContent,
            originalText,
            proposedText
          );

          if (result.replaced) {
            xmlContent = result.xml;
            appliedChanges.push(
              `Modified in "${change.sectionTitle}": "${this.truncate(change.original)}" → "${this.truncate(change.proposed)}"`
            );
            logger.info('DOCX Patch: modification applied', {
              section: change.sectionTitle,
              originalPreview: this.truncate(change.original),
            });
          } else {
            failedCount++;
            logger.warn('DOCX Patch: original text not found', {
              section: change.sectionTitle,
              original: this.truncate(change.original),
            });
          }
        } else if (change.type === 'addition') {
          // ADDITION: Find the section and append new content
          const result = this.addTextToSection(
            xmlContent,
            change.sectionTitle,
            change.proposed
          );

          if (result.added) {
            xmlContent = result.xml;
            appliedChanges.push(
              `Added to "${change.sectionTitle}": "${this.truncate(change.proposed)}"`
            );
            logger.info('DOCX Patch: addition applied', {
              section: change.sectionTitle,
              proposedPreview: this.truncate(change.proposed),
            });
          } else {
            failedCount++;
            logger.warn('DOCX Patch: could not find section for addition', {
              section: change.sectionTitle,
            });
          }
        } else if (change.type === 'removal' && change.original) {
          // REMOVAL: Remove the original text (replace with empty)
          const result = this.replaceTextInXml(
            xmlContent,
            change.original,
            ''
          );

          if (result.replaced) {
            xmlContent = result.xml;
            appliedChanges.push(
              `Removed from "${change.sectionTitle}": "${this.truncate(change.original)}"`
            );
          } else {
            failedCount++;
          }
        }
      } catch (err) {
        failedCount++;
        logger.error('DOCX Patch: error applying change', {
          changeId: change.id,
          error: String(err),
        });
      }
    }

    // Write the modified XML back
    zip.file('word/document.xml', xmlContent);

    // Re-zip to produce the patched DOCX
    const patchedBuffer = Buffer.from(
      zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
    );

    logger.info('DOCX Patch: complete', {
      applied: appliedChanges.length,
      rejected: rejectedCount,
      failed: failedCount,
    });

    return {
      buffer: patchedBuffer,
      appliedCount: appliedChanges.length,
      rejectedCount,
      failedCount,
      appliedChanges,
    };
  }

  /**
   * Find and replace text across XML runs in word/document.xml.
   *
   * DOCX splits text across multiple <w:r> (run) elements even for
   * consecutive characters. This method:
   * 1. Extracts all text content to find the target string
   * 2. Identifies which <w:t> elements contain parts of the target
   * 3. Replaces the text while preserving the run formatting
   *
   * We use a simplified approach: search for the text across concatenated
   * <w:t> elements within each <w:p> (paragraph), then rewrite only the
   * text nodes.
   */
  private replaceTextInXml(
    xml: string,
    searchText: string,
    replaceText: string
  ): { xml: string; replaced: boolean } {
    const escapedReplaceText = this.escapeXml(replaceText);
    // Strategy: find <w:p> paragraphs that contain the search text
    // across their concatenated <w:t> elements, then perform the replacement.

    const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
    let replaced = false;
    let newXml = xml;

    // Iterate through paragraphs
    newXml = xml.replace(paragraphRegex, (paragraph) => {
      if (replaced) return paragraph; // Only replace first occurrence

      // Extract all <w:t> text from this paragraph
      const textRegex = /<w:t(?:>| [^>]*>)([\s\S]*?)<\/w:t>/g;
      let fullText = '';
      const textNodes: Array<{ match: string; text: string; textIndex: number; paragraphIndex: number }> = [];
      let textMatch;

      while ((textMatch = textRegex.exec(paragraph)) !== null) {
        textNodes.push({
          match: textMatch[0],
          text: textMatch[1],
          textIndex: fullText.length,
          paragraphIndex: textMatch.index,
        });
        fullText += textMatch[1];
      }

      // Create a normalized mapping to ignore whitespace differences between AI and XML.
      // The AI often normalizes double-spaces or tabs, which breaks strict indexOf.
      const isWhitespace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

      let normFull = '';
      const fullMapping: number[] = [];
      for (let i = 0; i < fullText.length; i++) {
        if (!isWhitespace(fullText[i])) {
          normFull += fullText[i];
          fullMapping.push(i);
        }
      }

      let normSearch = '';
      for (let i = 0; i < searchText.length; i++) {
        if (!isWhitespace(searchText[i])) {
          normSearch += searchText[i];
        }
      }
      const normSearchIndex = normFull.indexOf(normSearch);

      if (normSearchIndex === -1) return paragraph;

      // Found it! Map the normalized index back to the real fullText index
      const searchIndex = fullMapping[normSearchIndex];
      const lastCharMatchIndex = normSearchIndex + normSearch.length - 1;
      const searchEnd = fullMapping[lastCharMatchIndex] + 1;

      replaced = true;
      let modifiedParagraph = paragraph;

      // Find which text nodes are affected
      let processedChars = 0;
      let firstAffectedNode = -1;
      let lastAffectedNode = -1;

      for (let i = 0; i < textNodes.length; i++) {
        const nodeStart = textNodes[i].textIndex;
        const nodeEnd = nodeStart + textNodes[i].text.length;

        if (nodeEnd > searchIndex && nodeStart < searchEnd) {
          if (firstAffectedNode === -1) firstAffectedNode = i;
          lastAffectedNode = i;
        }
      }

      if (firstAffectedNode === -1) return paragraph;

      // Replace nodes from last to first so string indexes don't shift!
      // Use the actual matched span length (accounts for extra whitespace in XML)
      const matchedSpanLength = searchEnd - searchIndex;

      let firstNodeInjection = escapedReplaceText;
      let lastNodeInjection = '';

      if (firstAffectedNode !== lastAffectedNode) {
        const firstNodeLocalStart = Math.max(0, searchIndex - textNodes[firstAffectedNode].textIndex);
        const firstNodeMatchText = textNodes[firstAffectedNode].text.substring(firstNodeLocalStart);
        
        let oIdx = 0;
        let rIdx = 0;
        let matchedChars = 0;
        
        while (oIdx < firstNodeMatchText.length && rIdx < replaceText.length) {
          if (isWhitespace(firstNodeMatchText[oIdx])) { oIdx++; continue; }
          if (isWhitespace(replaceText[rIdx])) { rIdx++; continue; }
          
          if (firstNodeMatchText[oIdx] === replaceText[rIdx]) {
            oIdx++;
            rIdx++;
            matchedChars++;
          } else {
            break;
          }
        }
        
        if (matchedChars > 0) {
          while (rIdx < replaceText.length && isWhitespace(replaceText[rIdx])) rIdx++;
          firstNodeInjection = this.escapeXml(replaceText.substring(0, rIdx));
          lastNodeInjection = this.escapeXml(replaceText.substring(rIdx));
        } else {
          firstNodeInjection = '';
          lastNodeInjection = escapedReplaceText;
        }
      }

      for (let i = lastAffectedNode; i >= firstAffectedNode; i--) {
        const node = textNodes[i];
        let newText = '';

        if (firstAffectedNode === lastAffectedNode) {
          // Single node replacement
          const localStart = searchIndex - node.textIndex;
          newText =
            node.text.substring(0, localStart) +
            escapedReplaceText +
            node.text.substring(localStart + matchedSpanLength);
        } else if (i === firstAffectedNode) {
          // First node of multi-node match
          const localStart = searchIndex - node.textIndex;
          newText = node.text.substring(0, localStart) + firstNodeInjection;
        } else if (i === lastAffectedNode) {
          // Last node of multi-node match
          const localEnd = searchEnd - node.textIndex;
          newText = lastNodeInjection + node.text.substring(localEnd);
        } else {
          // Middle node
          newText = '';
        }

        // Reconstruct tag preserving original attributes
        const prefixEnd = node.match.indexOf('>') + 1;
        let prefix = node.match.substring(0, prefixEnd);
        
        // Add xml:space="preserve" if needed and not already present
        if ((newText.startsWith(' ') || newText.endsWith(' ')) && !prefix.includes('xml:space=')) {
          prefix = prefix.replace('>', ' xml:space="preserve">');
        }

        const newTag = prefix + newText + '</w:t>';

        // Replace exactly at the original index
        modifiedParagraph =
          modifiedParagraph.substring(0, node.paragraphIndex) +
          newTag +
          modifiedParagraph.substring(node.paragraphIndex + node.match.length);
      }

      // Check if the modified paragraph is now completely empty of text
      const newTextRegex = /<w:t(?:>| [^>]*>)([\s\S]*?)<\/w:t>/g;
      let remainingText = '';
      let mMatch;
      while ((mMatch = newTextRegex.exec(modifiedParagraph)) !== null) {
        remainingText += mMatch[1];
      }
      
      // If the paragraph has no text left, delete the entire paragraph to avoid empty bullet points
      if (remainingText.trim() === '') {
        return '';
      }

      return modifiedParagraph;
    });

    return { xml: newXml, replaced };
  }

  /**
   * Add text to a section by finding a paragraph that contains the section
   * title and inserting a new paragraph after the last paragraph in that section.
   */
  private addTextToSection(
    xml: string,
    sectionTitle: string,
    newText: string
  ): { xml: string; added: boolean } {
    // Normalize the section title for searching
    const normalizedTitle = sectionTitle
      .replace(/[:\-–—]/g, '')
      .trim()
      .toLowerCase();

    // Find a paragraph containing the section title
    const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
    const paragraphs: Array<{ match: string; text: string; index: number }> = [];
    let pMatch;

    while ((pMatch = paragraphRegex.exec(xml)) !== null) {
      // Extract text from this paragraph
      const textRegex = /<w:t(?:>| [^>]*>)([\s\S]*?)<\/w:t>/g;
      let fullText = '';
      let tMatch;
      while ((tMatch = textRegex.exec(pMatch[0])) !== null) {
        fullText += tMatch[1];
      }

      paragraphs.push({
        match: pMatch[0],
        text: fullText,
        index: pMatch.index,
      });
    }

    // Find the paragraph that contains the section title
    let sectionParagraphIdx = -1;
    for (let i = 0; i < paragraphs.length; i++) {
      const pText = paragraphs[i].text
        .replace(/[:\-–—]/g, '')
        .trim()
        .toLowerCase();
      if (pText.includes(normalizedTitle) || normalizedTitle.includes(pText)) {
        sectionParagraphIdx = i;
        break;
      }
    }

    if (sectionParagraphIdx === -1) {
      return { xml, added: false };
    }

    // Find the last paragraph in this section (before the next section heading)
    // For simplicity, insert right after the section title paragraph
    const insertAfter = paragraphs[sectionParagraphIdx];

    // Create a new paragraph with the same basic formatting
    // Use a minimal paragraph with the proposed text
    const newParagraph = `<w:p><w:r><w:t xml:space="preserve">${this.escapeXml(newText)}</w:t></w:r></w:p>`;

    // Insert after the section title paragraph
    const insertPos = insertAfter.index + insertAfter.match.length;
    const newXml =
      xml.substring(0, insertPos) + newParagraph + xml.substring(insertPos);

    return { xml: newXml, added: true };
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/\n/g, '</w:t><w:br/><w:t xml:space="preserve">')
      .replace(/\t/g, '</w:t><w:tab/><w:t xml:space="preserve">');
  }

  /** Truncate text for logging. */
  private truncate(text: string, maxLen = 60): string {
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }

  /**
   * Strip leading bullet characters that the AI copies from our prompt formatting.
   * DOCX renders bullets via <w:numPr> formatting, not as literal text characters,
   * so these prefixes prevent the patch engine from finding the text.
   */
  private stripBulletPrefix(text: string): string {
    // Common bullet characters the AI might include
    return text.replace(/^[\s]*[•\-\*▪▸►◦○●]\s*/, '').trim();
  }
}
