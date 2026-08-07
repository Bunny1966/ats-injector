'use client';

import React, { useState, useCallback } from 'react';
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { getPreviewPdfUrl } from '@/lib/api';

interface PdfPreviewProps {
  sessionId: string;
  documentVersion: number;
}

/**
 * PDF preview component that displays the resume in an iframe.
 * Uses the backend's inline PDF serving endpoint.
 */
export default function PdfPreview({ sessionId, documentVersion }: PdfPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const pdfUrl = `${getPreviewPdfUrl(sessionId)}?v=${documentVersion}&r=${refreshKey}`;

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  return (
    <div className="pdf-preview-wrapper">
      {/* Toolbar */}
      <div className="pdf-preview-toolbar">
        <span className="text-xs text-[var(--text-muted)]">
          PDF Preview
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="pdf-refresh-btn"
          title="Refresh PDF preview"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* PDF iframe */}
      <div className="pdf-preview-body">
        {isLoading && (
          <div className="pdf-loading-overlay">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
            <span className="text-sm text-[var(--text-secondary)]">Loading PDF preview...</span>
          </div>
        )}

        {hasError ? (
          <div className="pdf-error">
            <AlertCircle className="h-8 w-8 text-[var(--color-warning)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              PDF preview not available yet.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Apply changes first, then the PDF will be generated automatically.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="pdf-retry-btn"
            >
              Try Again
            </button>
          </div>
        ) : (
          <iframe
            key={`pdf-${refreshKey}-${documentVersion}`}
            src={pdfUrl}
            title="Resume PDF Preview"
            className="pdf-iframe"
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </div>
    </div>
  );
}
