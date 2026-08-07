'use client';

import React from 'react';
import {
  FileText,
  Bot,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Download,
  BarChart3,
  FileEdit,
  Eye,
} from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Renders a single chat message bubble.
 * User messages appear on the right; system messages on the left.
 */
export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.type.startsWith('user-');
  const isError = message.type === 'system-error';
  const isLoading =
    message.type === 'system-parsing' ||
    message.type === 'system-analyzing' ||
    message.type === 'system-applying' ||
    message.type === 'system-editing';

  return (
    <div
      className={`animate-fade-in flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`
          flex h-8 w-8 shrink-0 items-center justify-center rounded-full
          ${isUser
            ? 'bg-gradient-to-tr from-[rgba(0,180,80,0.1)] to-[rgba(0,255,120,0.2)] text-[rgba(0,255,120,1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_2px_4px_rgba(0,0,0,0.3)] border border-white/5'
            : isError
            ? 'bg-[var(--color-error)]/15 text-[var(--color-error)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'glass-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_2px_4px_rgba(0,0,0,0.3)] text-[rgba(200,200,200,1)]'
          }
        `}
      >
        {isUser ? (
          message.type === 'user-edit' ? (
            <FileEdit className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )
        ) : isError ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div
        className={`
          max-w-[85%] rounded-[20px] px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.5)]
          ${isUser
            ? 'bg-gradient-to-br from-[rgba(0,255,120,0.05)] to-[rgba(0,180,80,0.1)] border border-[rgba(0,255,120,0.2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-tr-sm'
            : isError
            ? 'bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-tl-sm'
            : 'glass-card rounded-tl-sm'
          }
        `}
      >
        {/* Loading state with typing indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[rgba(0,255,120,0.8)]" />
            <span className="text-xs font-medium text-[rgba(0,255,120,0.8)]">
              {message.type === 'system-parsing'
                ? 'Parsing document...'
                : message.type === 'system-analyzing'
                ? 'Analyzing with AI...'
                : message.type === 'system-editing'
                ? 'Processing edit...'
                : 'Applying changes...'}
            </span>
          </div>
        )}

        {/* Message content */}
        <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
          {message.content}
        </p>

        {/* File info badge */}
        {message.data?.fileName && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)]/80 px-2.5 py-1">
            <FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-secondary)]">
              {message.data.fileName}
            </span>
            {message.data.fileSize && (
              <span className="text-xs text-[var(--text-muted)]">
                ({(message.data.fileSize / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        )}

        {/* ATS Score badge */}
        {message.data?.result && (
          <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)]/80 px-3 py-2">
            <BarChart3 className="h-4 w-4 text-[var(--accent-primary)]" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              ATS Score:
            </span>
            <span className="text-sm font-bold text-[var(--accent-primary)]">
              {message.data.result.analysis.overallScore}%
            </span>
          </div>
        )}

        {/* Download links */}
        {message.data?.downloadUrl && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={message.data.downloadUrl}
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-success)]/10 px-3 py-2 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download DOCX
            </a>
            {message.data.pdfDownloadUrl && (
              <a
                href={message.data.pdfDownloadUrl}
                className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[rgba(0,150,255,0.1)] px-3 py-2 text-xs font-medium text-[rgba(100,180,255,1)] hover:bg-[rgba(0,150,255,0.2)] transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </a>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className="mt-2 text-[10px] text-[var(--text-muted)]">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
