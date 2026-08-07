import fs from 'fs';
import path from 'path';
import { DocxPatchEngine } from '../src/patch/docx-patch.engine';
import PizZip from 'pizzip';
import type { ChangeRecommendation, ChangeDecision } from '@resume-optimizer/shared';

const patchEngine = new DocxPatchEngine();
const docPath = path.join(__dirname, '../uploads/056e4257-ecd1-44c4-b351-4f4ef25cdbbf.docx');
const originalBuffer = fs.readFileSync(docPath);

const changes: ChangeRecommendation[] = [
  {
    id: 'c1',
    type: 'modification',
    targetId: 't1',
    sectionId: 's1',
    sectionTitle: 'Technical Languages',
    original: 'Frameworks: React, MERN stack, NextJS, Tailwind CSS',
    proposed: 'Frameworks: React, MERN stack, NextJS, Tailwind CSS, Jest',
    reason: '',
    confidence: 'high',
    atsImpact: 'high',
    category: 'skill',
    status: 'approved'
  }
];

const decisions: ChangeDecision[] = [
  { changeId: 'c1', status: 'approved' }
];

async function run() {
  const result = await patchEngine.apply(originalBuffer, changes, decisions);
  
  if (result.buffer) {
    fs.writeFileSync(path.join(__dirname, 'patched.docx'), result.buffer);
    console.log('Patched docx written');
    
    const zip = new PizZip(result.buffer);
    const xml = zip.file('word/document.xml')?.asText();
    fs.writeFileSync(path.join(__dirname, 'patched.xml'), xml || '');
    console.log('XML extracted');
  }
}

run().catch(console.error);
