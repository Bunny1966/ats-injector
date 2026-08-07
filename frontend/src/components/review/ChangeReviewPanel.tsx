'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Download,
  BarChart3,
  Loader2,
  CheckCheck,
  XOctagon,
  FileText,
} from 'lucide-react';
import ChangeCard from './ChangeCard';
import type { ChangeRecommendation, ChangeStatus } from '@/types';

interface ChangeReviewPanelProps {
  changes: ChangeRecommendation[];
  decisions: Map<string, ChangeStatus>;
  editedProposed: Map<string, string>;
  currentScore: number;
  projectedScore: number;
  fileType: string;
  isApplying: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onApplyChanges: () => void;
  onEditProposed: (id: string, text: string) => void;
  isComplete?: boolean;
}

/**
 * Container panel for reviewing all AI change recommendations.
 * Includes bulk actions, score visualization, and apply button.
 */
export default function ChangeReviewPanel({
  changes,
  decisions,
  editedProposed,
  currentScore,
  projectedScore,
  fileType,
  isApplying,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
  onApplyChanges,
  onEditProposed,
  isComplete,
}: ChangeReviewPanelProps) {
  const approvedCount = Array.from(decisions.values()).filter(
    (s) => s === 'approved'
  ).length;
  const rejectedCount = Array.from(decisions.values()).filter(
    (s) => s === 'rejected'
  ).length;
  const pendingCount = changes.length - approvedCount - rejectedCount;
  const allDecided = pendingCount === 0;
  const isPdf = fileType === 'pdf';

  // Score circle SVG parameters
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const scoreOffset =
    circumference - (currentScore / 100) * circumference;
  const projectedOffset =
    circumference - (projectedScore / 100) * circumference;

  return (
    <div className="animate-slide-up w-full max-w-[85%] mb-4">
      <div className="glass-card flex flex-col overflow-hidden border border-white/10 shadow-lg rounded-[20px] rounded-tl-sm">
      {/* Panel Header */}
      <div className="bg-black/60 p-4 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Review Changes
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {changes.length} recommendation{changes.length !== 1 ? 's' : ''} from AI analysis
            </p>
          </div>

          {/* Score Visualization */}
          <div className="flex items-center gap-4">
            {/* Current Score */}
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="var(--border-subtle)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={scoreOffset}
                    className="score-ring"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-[var(--text-primary)]">
                    {currentScore}%
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] mt-1">Current</span>
            </div>

            {/* Arrow */}
            <div className="text-[var(--text-muted)] text-lg">→</div>

            {/* Projected Score */}
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="var(--border-subtle)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="var(--color-success)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={projectedOffset}
                    className="score-ring"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-[var(--color-success)]">
                    {projectedScore}%
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] mt-1">Projected</span>
            </div>
          </div>
        </div>

        {/* Stats + Bulk Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
              <span className="text-[var(--text-secondary)]">
                {approvedCount} approved
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <XCircle className="h-3.5 w-3.5 text-[var(--color-error)]" />
              <span className="text-[var(--text-secondary)]">
                {rejectedCount} rejected
              </span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <BarChart3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">
                  {pendingCount} pending
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onApproveAll}
              className="btn-skeuo-glass flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium text-white cursor-pointer"
            >
              <CheckCheck className="h-3 w-3" />
              Approve All
            </button>
            <button
              onClick={onRejectAll}
              className="btn-skeuo-glass flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium text-white cursor-pointer"
            >
              <XOctagon className="h-3 w-3" />
              Reject All
            </button>
          </div>
        </div>
      </div>

      {/* Change Cards (Scrollable List) */}
      <div className="max-h-[350px] overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-3 bg-black/40">
        {changes.map((change, i) => (
          <ChangeCard
            key={change.id}
            change={change}
            index={i}
            status={decisions.get(change.id) || 'pending'}
            editedText={editedProposed.get(change.id)}
            onApprove={onApprove}
            onReject={onReject}
            onEditProposed={onEditProposed}
          />
        ))}
      </div>

      {/* Apply Button */}
      <div className="bg-[var(--bg-surface)] p-4 border-t border-white/5">
        {isPdf ? (
          /* PDF: Show copy-paste instructions note */
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                PDF Resume — Manual Apply Mode
              </p>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-3 max-w-md mx-auto">
              Since PDFs can&apos;t be edited without breaking formatting, approved changes are shown above as a checklist. Copy the proposed text and paste it into your resume manually.
            </p>
            {allDecided && approvedCount > 0 && (
              <button
                onClick={onApplyChanges}
                disabled={isApplying || isComplete}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] text-sm font-semibold transition-all ${
                  isComplete
                    ? 'bg-white/10 text-white/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white hover:shadow-lg hover:shadow-[var(--accent-glow-strong)] cursor-pointer'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isComplete ? 'Changes Applied' : 'Mark as Complete'}
              </button>
            )}
          </div>
        ) : (
          /* DOCX: Full apply and download */
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)]">
                {allDecided
                  ? `${approvedCount} change${approvedCount !== 1 ? 's' : ''} will be applied`
                  : `${pendingCount} change${pendingCount !== 1 ? 's' : ''} still pending`}
              </p>
            </div>
            <button
              onClick={onApplyChanges}
              disabled={isApplying || !allDecided || isComplete}
              className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-all ${
                !allDecided
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed border border-white/5'
                  : isApplying || isComplete
                  ? 'bg-white/10 text-white/50 cursor-not-allowed border border-white/10'
                  : 'btn-skeuo-glass text-white cursor-pointer text-green-300'
              }`}
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : isComplete ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Changes Applied
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Apply Changes & Download
                </>
              )}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
