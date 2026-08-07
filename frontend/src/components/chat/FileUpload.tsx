'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, FileIcon } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  uploadedFileName?: string;
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export default function FileUpload({
  onFileSelect,
  isUploading,
  uploadedFileName,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading,
  });

  if (uploadedFileName) {
    return (
      <div className="animate-fade-in flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-success)]/10">
          <FileText className="h-5 w-5 text-[var(--color-success)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {uploadedFileName}
          </p>
          <p className="text-xs text-[var(--color-success)]">Uploaded successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      id="file-upload-dropzone"
      className={`
        group relative cursor-pointer rounded-[var(--radius-lg)] border-2 border-dashed
        p-8 text-center transition-all duration-[var(--transition-default)]
        ${
          isDragActive && !isDragReject
            ? 'border-[var(--accent-primary)] bg-[var(--accent-glow)] scale-[1.01]'
            : isDragReject
            ? 'border-[var(--color-error)] bg-[var(--color-error)]/5'
            : 'border-[var(--border-default)] bg-[var(--bg-tertiary)]/50 hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-glow)]'
        }
        ${isUploading ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <input {...getInputProps()} id="file-upload-input" />

      <div className="flex flex-col items-center gap-3">
        {isUploading ? (
          <>
            <div className="h-12 w-12 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Uploading & parsing your resume...
            </p>
          </>
        ) : (
          <>
            <div
              className={`
                flex h-14 w-14 items-center justify-center rounded-full
                transition-all duration-[var(--transition-default)]
                ${
                  isDragActive
                    ? 'bg-[var(--accent-primary)]/20 scale-110'
                    : 'bg-[var(--bg-surface)] group-hover:bg-[var(--accent-primary)]/10'
                }
              `}
            >
              <Upload
                className={`h-6 w-6 transition-colors duration-[var(--transition-default)] ${
                  isDragActive
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]'
                }`}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {isDragActive
                  ? 'Drop your resume here'
                  : 'Drag & drop your resume'}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                or click to browse • PDF, DOCX up to 10MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
