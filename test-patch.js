const fs = require('fs');

function isWhitespace(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replaceTextInXml(xml, searchText, replaceText) {
  const escapedReplaceText = escapeXml(replaceText);
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let replaced = false;
  let newXml = xml;

  newXml = xml.replace(paragraphRegex, (paragraph) => {
    if (replaced) return paragraph;

    const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let fullText = '';
    const textNodes = [];
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

    let normFull = '';
    const fullMapping = [];
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

    const searchIndex = fullMapping[normSearchIndex];
    const lastCharMatchIndex = normSearchIndex + normSearch.length - 1;
    const searchEnd = fullMapping[lastCharMatchIndex] + 1;

    replaced = true;
    let modifiedParagraph = paragraph;

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
        firstNodeInjection = escapeXml(replaceText.substring(0, rIdx));
        lastNodeInjection = escapeXml(replaceText.substring(rIdx));
      } else {
        firstNodeInjection = '';
        lastNodeInjection = escapedReplaceText;
      }
    }

    for (let i = lastAffectedNode; i >= firstAffectedNode; i--) {
      const node = textNodes[i];
      let newText = '';

      if (firstAffectedNode === lastAffectedNode) {
        const localStart = searchIndex - node.textIndex;
        newText =
          node.text.substring(0, localStart) +
          escapedReplaceText +
          node.text.substring(localStart + matchedSpanLength);
      } else if (i === firstAffectedNode) {
        const localStart = searchIndex - node.textIndex;
        newText = node.text.substring(0, localStart) + firstNodeInjection;
      } else if (i === lastAffectedNode) {
        const localEnd = searchEnd - node.textIndex;
        newText = lastNodeInjection + node.text.substring(localEnd);
      } else {
        newText = '';
      }

      const prefixEnd = node.match.indexOf('>') + 1;
      let prefix = node.match.substring(0, prefixEnd);
      
      if ((newText.startsWith(' ') || newText.endsWith(' ')) && !prefix.includes('xml:space=')) {
        prefix = prefix.replace('>', ' xml:space="preserve">');
      }

      const newTag = prefix + newText + '</w:t>';

      modifiedParagraph =
        modifiedParagraph.substring(0, node.paragraphIndex) +
        newTag +
        modifiedParagraph.substring(node.paragraphIndex + node.match.length);
    }

    return modifiedParagraph;
  });

  return { xml: newXml, replaced };
}

// Test case
const testXml = `<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>World</w:t></w:r></w:p>`;
const result = replaceTextInXml(testXml, "Hello World", "Hello Advait");
console.log(result.replaced ? "SUCCESS" : "FAILED", result.xml);

// Test case 2: replacing across nodes when lengths change
const testXml2 = `<w:p><w:r><w:t>My skills </w:t></w:r><w:r><w:t>include React, </w:t></w:r><w:r><w:t>Node, and NextJS.</w:t></w:r></w:p>`;
const result2 = replaceTextInXml(testXml2, "My skills include React, Node, and NextJS.", "My skills include React, Node, and Python.");
console.log(result2.replaced ? "SUCCESS" : "FAILED", result2.xml);
