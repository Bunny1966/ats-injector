'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Target,
  Tag,
  PenLine,
} from 'lucide-react';
import type { ChangeRecommendation, ChangeStatus } from '@/types';

interface ChangeCardProps {
  change: ChangeRecommendation;
  index: number;
  status: ChangeStatus;
  editedText?: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEditProposed: (id: string, text: string) => void;
}

/**
 * Individual change recommendation card with diff view and approve/reject.
 * The "Proposed" section is editable — users can manually tweak the AI suggestion.
 */
export default function ChangeCard({
  change,
  index,
  status,
  editedText,
  onApprove,
  onReject,
  onEditProposed,
}: ChangeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(editedText ?? change.proposed);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep localText in sync if editedText changes externally
  useEffect(() => {
    if (!isEditing) {
      setLocalText(editedText ?? change.proposed);
    }
  }, [editedText, change.proposed, isEditing]);

  // Auto-resize and focus when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    const trimmed = localText.trim();
    if (trimmed && trimmed !== change.proposed) {
      onEditProposed(change.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setLocalText(editedText ?? change.proposed);
    setIsEditing(false);
  };

  const isEdited = (editedText !== undefined) && (editedText !== change.proposed);

  const typeConfig = {
    addition: {
      icon: Plus,
      label: 'Addition',
      badgeClass: 'badge-addition',
      color: 'white',
    },
    modification: {
      icon: Pencil,
      label: 'Modification',
      badgeClass: 'badge-modification',
      color: 'white',
    },
    removal: {
      icon: Trash2,
      label: 'Removal',
      badgeClass: 'badge-removal',
      color: 'white',
    },
  };

  const config = typeConfig[change.type as keyof typeof typeConfig];
  const TypeIcon = config.icon;

  return (
    <div
      className="change-card rounded-[var(--radius-md)] bg-[var(--bg-tertiary)] p-4 animate-stagger-in"
      data-status={status}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${config.color}15` }}
          >
            <TypeIcon className="h-3.5 w-3.5" style={{ color: config.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-secondary)] truncate">
              {change.sectionTitle}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isEdited && (
            <span className="badge bg-[var(--accent-primary)]/10 text-[var(--text-accent)]">
              <PenLine className="h-2.5 w-2.5" />
              Edited
            </span>
          )}
          <span className={`badge ${config.badgeClass}`}>
            {config.label}
          </span>
          <span className={`badge badge-${change.atsImpact}`}>
            <Target className="h-2.5 w-2.5" />
            {change.atsImpact}
          </span>
        </div>
      </div>

      {/* Diff View */}
      <div className="mb-3 space-y-2">
        {change.original && (
          <div className="rounded-[var(--radius-sm)] bg-[var(--bg-primary)]/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1 tracking-wider">
              Original
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed diff-remove">
              {change.original}
            </p>
          </div>
        )}
        {change.proposed && (
          <div className="rounded-[var(--radius-sm)] bg-[var(--bg-primary)]/60 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                {change.original && (
                  <ArrowRight className="h-2.5 w-2.5 text-white/50" />
                )}
                <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)] tracking-wider">
                  Proposed {isEdited ? '(Edited)' : ''}
                </p>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-skeuo-glass flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:text-white cursor-pointer"
                  title="Edit proposed text"
                >
                  <PenLine className="h-2.5 w-2.5" />
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  ref={textareaRef}
                  value={localText}
                  onChange={(e) => {
                    setLocalText(e.target.value);
                    // Auto-resize
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[var(--text-primary)] leading-relaxed resize-none outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
                  rows={3}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="btn-skeuo-glass flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-white text-[10px] font-medium cursor-pointer"
                  >
                    <Check className="h-2.5 w-2.5" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="btn-skeuo-glass flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] text-[10px] font-medium hover:text-white cursor-pointer"
                  >
                    <X className="h-2.5 w-2.5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-primary)] leading-relaxed diff-add">
                {editedText ?? change.proposed}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Reason */}
      <div className="flex items-start gap-1.5 mb-3">
        <Sparkles className="h-3 w-3 text-[var(--accent-secondary)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {change.reason}
        </p>
      </div>

      {/* Matched keywords */}
      {change.matchedKeywords && change.matchedKeywords.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Tag className="h-3 w-3 text-[var(--text-muted)]" />
          {change.matchedKeywords.map((kw: string) => (
            <span
              key={kw}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--text-accent)]"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {status === 'pending' ? (
          <>
            <button
              onClick={() => onApprove(change.id)}
              className="btn-skeuo-glass flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-white text-xs font-medium cursor-pointer text-green-300 hover:text-green-200"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={() => onReject(change.id)}
              className="btn-skeuo-glass flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] text-xs font-medium hover:text-red-300 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </button>
          </>
        ) : (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium border border-white/10 ${
              status === 'approved'
                ? 'bg-white/10 text-white'
                : 'bg-black/40 text-[var(--text-muted)]'
            }`}
          >
            {status === 'approved' ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Approved
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5" />
                Rejected
              </>
            )}
            {/* Undo button */}
            <button
              onClick={() =>
                status === 'approved'
                  ? onReject(change.id)
                  : onApprove(change.id)
              }
              className="ml-2 text-[10px] underline opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            >
              Undo
            </button>
          </div>
        )}

        {/* Confidence */}
        <span className={`badge badge-${change.confidence} ml-auto`}>
          <Sparkles className="h-2.5 w-2.5" />
          {change.confidence} confidence
        </span>
      </div>
    </div>
  );
}
