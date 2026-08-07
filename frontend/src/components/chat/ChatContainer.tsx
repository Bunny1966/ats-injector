'use client';

import React, { useRef, useEffect } from 'react';
import { Sparkles, Zap, Wand2, Rocket, FileText, Bot } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import FileUpload from './FileUpload';
import ChangeReviewPanel from '../review/ChangeReviewPanel';
import type { ChatMessage as ChatMessageData, ChangeStatus, OptimizationResult, OptimizationMode } from '@/types';
import type { SavedResume } from '@/lib/api';

interface ChatContainerProps {
  messages: ChatMessageData[];
  savedResumes: SavedResume[];
  onFileSelect: (file: File) => void;
  onSelectSavedResume: (id: string) => void;
  onSendMessage: (message: string) => void;
  isUploading: boolean;
  isProcessing: boolean;
  isApplying: boolean;
  uploadedFileName?: string;
  uploadedFileType?: string;
  currentStep: 'upload' | 'job-description' | 'reviewing' | 'complete';
  optimizationResult?: OptimizationResult;
  changeDecisions: Map<string, ChangeStatus>;
  optimizationMode: OptimizationMode;
  onModeChange: (mode: OptimizationMode) => void;
  onApproveChange: (id: string) => void;
  onRejectChange: (id: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onApplyChanges: () => void;
  editedProposed: Map<string, string>;
  onEditProposed: (id: string, text: string) => void;
}

/**
 * Main chat container that orchestrates the conversation flow.
 * Handles auto-scrolling, step-based UI, and message rendering.
 */
export default function ChatContainer({
  messages,
  savedResumes,
  onFileSelect,
  onSelectSavedResume,
  onSendMessage,
  isUploading,
  isProcessing,
  isApplying,
  uploadedFileName,
  uploadedFileType,
  currentStep,
  optimizationResult,
  changeDecisions,
  optimizationMode,
  onModeChange,
  onApproveChange,
  onRejectChange,
  onApproveAll,
  onRejectAll,
  onApplyChanges,
  editedProposed,
  onEditProposed,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInputPlaceholder = () => {
    switch (currentStep) {
      case 'upload':
        return 'Upload your resume first...';
      case 'job-description':
        return 'Paste the job description here to start analysis...';
      case 'reviewing':
        return 'Review the suggested changes, or type an edit command...';
      case 'complete':
        return 'Paste a new job description to optimize this resume again...';
      default:
        return 'Type a message...';
    }
  };

  return (
    <div className="flex h-full flex-col">

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {/* Welcome message when empty */}
        {messages.length === 0 && (
          <div className="animate-slide-up flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 animate-pulse-glow">
              <Sparkles className="h-10 w-10 text-[var(--accent-primary)]" />
            </div>
            <h2 className="text-xl font-semibold gradient-text mb-2">
              Optimize Your Resume
            </h2>
            <p className="max-w-sm text-sm text-[var(--text-secondary)] leading-relaxed">
              Upload your resume and paste a job description. I&apos;ll analyze ATS
              compatibility and suggest targeted improvements while preserving
              your original formatting.
            </p>

            {/* Step indicators */}
            <div className="mt-8 flex items-center gap-3">
              {['Upload Resume', 'Paste JD', 'Review Changes', 'Download'].map(
                (step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`
                          flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold
                          ${i === 0
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                          }
                        `}
                      >
                        {i + 1}
                      </div>
                      <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                        {step}
                      </span>
                    </div>
                    {i < 3 && (
                      <div className="h-px w-6 bg-[var(--border-default)]" />
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Render messages and inject the review panel in chronological order */}
        {messages.map((msg, index) => {
          const isLastAnalysis = msg.type === 'system-analysis' && 
            messages.slice(index + 1).every(m => m.type !== 'system-analysis');

          return (
            <React.Fragment key={msg.id}>
              <ChatMessage message={msg} />
              
              {isLastAnalysis &&
                (currentStep === 'reviewing' || currentStep === 'complete') &&
                optimizationResult &&
                optimizationResult.changes.length > 0 && (
                  <div className="animate-fade-in flex gap-3 flex-row mt-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-accent)]">
                      <Bot className="h-4 w-4" />
                    </div>
                    <ChangeReviewPanel
                      changes={optimizationResult.changes}
                      decisions={changeDecisions}
                      editedProposed={editedProposed}
                      currentScore={optimizationResult.analysis.overallScore}
                      projectedScore={optimizationResult.projectedScore}
                      fileType={uploadedFileType || 'docx'}
                      isApplying={isApplying}
                      onApprove={onApproveChange}
                      onReject={onRejectChange}
                      onApproveAll={onApproveAll}
                      onRejectAll={onRejectAll}
                      onApplyChanges={onApplyChanges}
                      onEditProposed={onEditProposed}
                      isComplete={currentStep === 'complete'}
                    />
                  </div>
                )}
            </React.Fragment>
          );
        })}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 bg-transparent px-6 py-4 space-y-3">
        {/* File upload zone — show when no file uploaded yet */}
        {currentStep === 'upload' && (
          <div className="flex flex-col gap-4">
            <FileUpload
              onFileSelect={onFileSelect}
              isUploading={isUploading}
              uploadedFileName={uploadedFileName}
            />
            
            {savedResumes && savedResumes.length > 0 && !uploadedFileName && (
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] mb-3 text-center uppercase tracking-wider">Or select a saved resume</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {savedResumes.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => onSelectSavedResume(r.id)}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 text-xs text-[var(--text-primary)] transition-all disabled:opacity-50 shadow-sm"
                    >
                      <FileText className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      <span className="truncate max-w-[150px]">{r.file_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode selection is now handled inside ChatInput */}

        {/* Chat input */}
        <ChatInput
          onSendMessage={onSendMessage}
          disabled={
            currentStep === 'upload' ||
            isUploading ||
            isProcessing
          }
          optimizationMode={optimizationMode}
          onModeChange={onModeChange}
          placeholder={getInputPlaceholder()}
        />
      </div>
    </div>
  );
}
