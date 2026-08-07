'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import { Save, Loader2, Link as LinkIcon, X } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import { getResumeHtml, saveManualEdits } from '@/lib/api';
import type { ManualEdit } from '@/types';

interface ResumeEditorProps {
  sessionId: string;
  documentVersion: number;
  onSaved?: () => void;
}

/**
 * TipTap rich text editor for manual resume editing.
 * Loads HTML from the backend, allows inline editing, and saves diffs.
 */
export default function ResumeEditor({ sessionId, documentVersion, onSaved }: ResumeEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [originalHtml, setOriginalHtml] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions that conflict with our standalone ones
      }),
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
    ],
    content: '<p>Loading document...</p>',
    immediatelyRender: true, // Prevent Next.js hydration warning
    editorProps: {
      attributes: {
        class: 'resume-editor-content',
      },
    },
  });

  // Load HTML from backend
  const loadHtml = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getResumeHtml(sessionId);
      if (response.success && response.data) {
        const html = response.data.html;
        setOriginalHtml(html);
        editor?.commands.setContent(html);
      }
    } catch (error) {
      console.error('Failed to load resume HTML:', error);
      editor?.commands.setContent('<p style="color:red;">Failed to load document. Please try again.</p>');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, editor]);

  // Load on mount and when documentVersion changes
  useEffect(() => {
    if (editor && sessionId) {
      loadHtml();
    }
  }, [editor, sessionId, documentVersion, loadHtml]);

  // Focus link input when shown
  useEffect(() => {
    if (showLinkInput && linkInputRef.current) {
      linkInputRef.current.focus();
    }
  }, [showLinkInput]);

  /**
   * Extract text diffs between original and edited HTML.
   * We compare the plain text content to find what changed using a simple LCS approach
   * so that paragraph insertions/deletions don't shift and corrupt the mapping.
   */
  const extractDiffs = useCallback((): ManualEdit[] => {
    if (!editor) return [];

    const currentHtml = editor.getHTML();
    
    // Extract text from HTML (simple approach)
    const extractText = (html: string): string => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return (div.textContent || '').trim();
    };

    const extractParts = (html: string) => 
      html.split(/<\/p>|<\/li>|<\/h[1-6]>/)
          .map(extractText)
          .filter(t => t.length > 0);

    const originalParts = extractParts(originalHtml);
    const currentParts = extractParts(currentHtml);

    if (originalParts.join('\n') === currentParts.join('\n')) return [];

    // Simple greedy matching from both ends to isolate the changed section
    let start = 0;
    while (start < originalParts.length && start < currentParts.length && originalParts[start] === currentParts[start]) {
      start++;
    }

    let endOrig = originalParts.length - 1;
    let endCurr = currentParts.length - 1;
    while (endOrig >= start && endCurr >= start && originalParts[endOrig] === currentParts[endCurr]) {
      endOrig--;
      endCurr--;
    }

    const edits: ManualEdit[] = [];
    
    // Fallback if it's a pure addition and we can't find an original paragraph to replace.
    // We attach it to the preceding paragraph so the backend can replace (prevText) with (prevText + newText)
    if (start > endOrig) {
      if (start > 0) {
        edits.push({
          original: originalParts[start - 1],
          replacement: originalParts[start - 1] + '\n' + currentParts.slice(start, endCurr + 1).join('\n')
        });
      }
      return edits;
    }

    // Otherwise, we map the changed original paragraphs to the new ones sequentially.
    // If there are more new paragraphs than old, we lump the extra new ones into the last old paragraph.
    const numOrig = endOrig - start + 1;
    for (let i = 0; i < numOrig; i++) {
      const oText = originalParts[start + i];
      if (i === numOrig - 1) {
        // Last original paragraph takes the rest of the new paragraphs
        const cTexts = currentParts.slice(start + i, endCurr + 1).join('\n');
        if (oText !== cTexts) edits.push({ original: oText, replacement: cTexts });
      } else {
        const cText = start + i <= endCurr ? currentParts[start + i] : '';
        if (oText !== cText) edits.push({ original: oText, replacement: cText });
      }
    }

    return edits;
  }, [editor, originalHtml]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!editor || isSaving) return;

    const diffs = extractDiffs();
    if (diffs.length === 0) {
      setSaveStatus('No changes detected');
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const response = await saveManualEdits(sessionId, diffs);
      if (response.success && response.data) {
        const { appliedCount, failedCount } = response.data;
        setSaveStatus(`✅ ${appliedCount} edit(s) saved${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
        // Refresh original HTML to the new state
        await loadHtml();
        onSaved?.();
      } else {
        setSaveStatus('❌ Failed to save edits');
      }
    } catch (error) {
      console.error('Failed to save edits:', error);
      setSaveStatus('❌ Save failed. Please try again.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  }, [editor, isSaving, extractDiffs, sessionId, loadHtml, onSaved]);

  // Handle link insertion
  const handleInsertLink = useCallback(() => {
    if (!editor) return;

    // If text is selected and already has a link, pre-fill the URL
    const existingLink = editor.getAttributes('link').href;
    setLinkUrl(existingLink || 'https://');
    setShowLinkInput(true);
  }, [editor]);

  const confirmLink = useCallback(() => {
    if (!editor || !linkUrl) return;

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: linkUrl })
      .run();

    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  return (
    <div className="resume-editor-wrapper">
      {/* Toolbar */}
      <EditorToolbar editor={editor} onInsertLink={handleInsertLink} />

      {/* Link input popover */}
      {showLinkInput && (
        <div className="editor-link-popover">
          <LinkIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmLink();
              if (e.key === 'Escape') setShowLinkInput(false);
            }}
            placeholder="https://example.com"
            className="editor-link-input"
          />
          <button
            type="button"
            onClick={confirmLink}
            className="editor-link-confirm"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="editor-link-cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Editor content */}
      <div className="resume-editor-body">
        {isLoading ? (
          <div className="editor-loading">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-primary)]" />
            <span>Loading document...</span>
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      {/* Footer with save button */}
      <div className="resume-editor-footer">
        {saveStatus && (
          <span className="editor-save-status">{saveStatus}</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="editor-save-btn"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
