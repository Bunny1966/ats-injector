'use client';

import React, { useState } from 'react';
import { X, FileEdit, Eye } from 'lucide-react';
import ResumeEditor from './ResumeEditor';
import PdfPreview from './PdfPreview';

interface DocumentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  documentVersion: number;
  onDocumentEdited?: () => void;
  fileName?: string;
}

type SidebarTab = 'editor' | 'preview';

/**
 * Claude-style sliding document sidebar.
 * Contains two tabs: "Editor" for manual editing and "Preview" for PDF view.
 */
export default function DocumentSidebar({
  isOpen,
  onClose,
  sessionId,
  documentVersion,
  onDocumentEdited,
  fileName,
}: DocumentSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('editor');

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`sidebar-panel ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-header-info">
            <h2 className="sidebar-title">Document Editor</h2>
            {fileName && (
              <span className="sidebar-filename">{fileName}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sidebar-close-btn"
            title="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="sidebar-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`sidebar-tab ${activeTab === 'editor' ? 'sidebar-tab-active' : ''}`}
          >
            <FileEdit className="h-3.5 w-3.5" />
            Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`sidebar-tab ${activeTab === 'preview' ? 'sidebar-tab-active' : ''}`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>

        {/* Tab content */}
        <div className="sidebar-content">
          {activeTab === 'editor' ? (
            <ResumeEditor
              sessionId={sessionId}
              documentVersion={documentVersion}
              onSaved={onDocumentEdited}
            />
          ) : (
            <PdfPreview
              sessionId={sessionId}
              documentVersion={documentVersion}
            />
          )}
        </div>
      </div>
    </>
  );
}
