'use client';

import React from 'react';
import { Bold, Italic, Underline, Link, Unlink, Undo2, Redo2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertLink: () => void;
}

/**
 * Formatting toolbar for the TipTap rich text editor.
 * Provides bold, italic, underline, link, and undo/redo controls.
 */
export default function EditorToolbar({ editor, onInsertLink }: EditorToolbarProps) {
  if (!editor) return null;

  const tools = [
    {
      icon: Bold,
      label: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      icon: Italic,
      label: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      icon: Underline,
      label: 'Underline',
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
    },
    {
      icon: Link,
      label: 'Add Link',
      action: onInsertLink,
      isActive: editor.isActive('link'),
    },
    {
      icon: Unlink,
      label: 'Remove Link',
      action: () => editor.chain().focus().unsetLink().run(),
      isActive: false,
      disabled: !editor.isActive('link'),
    },
  ];

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar-group">
        {tools.map((tool: any) => (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            onClick={tool.action}
            disabled={'disabled' in tool ? tool.disabled : false}
            className={`editor-toolbar-btn ${tool.isActive ? 'active' : ''}`}
          >
            <tool.icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="editor-toolbar-divider" />

      <div className="editor-toolbar-group">
        <button
          type="button"
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="editor-toolbar-btn"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="editor-toolbar-btn"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
