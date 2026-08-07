'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { uploadResume, loadSavedResume, getSavedResumes, analyzeResume, applyChanges, sendChatEdit } from '@/lib/api';
import type { SavedResume } from '@/lib/api';
import type { ChatMessage, OptimizationResult, ChangeStatus, OptimizationMode } from '@/types';

type WorkflowStep = 'upload' | 'job-description' | 'reviewing' | 'complete';

interface UseResumeOptimizerReturn {
  messages: ChatMessage[];
  currentStep: WorkflowStep;
  isUploading: boolean;
  isProcessing: boolean;
  isApplying: boolean;
  uploadedFileName?: string;
  uploadedFileType?: string;
  sessionId?: string;
  documentVersion: number;
  incrementDocumentVersion: () => void;
  optimizationResult?: OptimizationResult;
  changeDecisions: Map<string, ChangeStatus>;
  optimizationMode: OptimizationMode;
  savedResumes: SavedResume[];
  setOptimizationMode: (mode: OptimizationMode) => void;
  handleFileSelect: (file: File) => void;
  handleLoadSavedResume: (resumeId: string) => Promise<void>;
  handleSendMessage: (message: string) => void;
  handleApproveChange: (id: string) => void;
  handleRejectChange: (id: string) => void;
  handleApproveAll: () => void;
  handleRejectAll: () => void;
  handleApplyChanges: () => void;
  editedProposed: Map<string, string>;
  handleEditProposed: (id: string, text: string) => void;
}

/**
 * Main orchestration hook for the resume optimization workflow.
 * Manages the conversation state machine:
 *   upload → job-description → reviewing → complete
 */
export function useResumeOptimizer(): UseResumeOptimizerReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>();
  const [uploadedFileType, setUploadedFileType] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult>();
  const [changeDecisions, setChangeDecisions] = useState<Map<string, ChangeStatus>>(
    new Map()
  );
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('quick');
  const [editedProposed, setEditedProposed] = useState<Map<string, string>>(new Map());
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);

  const [documentVersion, setDocumentVersion] = useState(1);

  const incrementDocumentVersion = useCallback(() => {
    setDocumentVersion((v) => v + 1);
  }, []);

  /** Add a message to the chat. */
  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const fullMsg: ChatMessage = {
      ...msg,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, fullMsg]);
    return fullMsg;
  }, []);

  /** Update the last system message (for replacing loading states). */
  const updateLastSystemMessage = useCallback(
    (update: Partial<ChatMessage>) => {
      setMessages((prev) => {
        const last = [...prev];
        for (let i = last.length - 1; i >= 0; i--) {
          if (last[i].type.startsWith('system-')) {
            last[i] = { ...last[i], ...update };
            break;
          }
        }
        return last;
      });
    },
    []
  );

  /** Fetch saved resumes on mount */
  useEffect(() => {
    // Only fetch if on upload step and not currently loading anything else
    if (currentStep === 'upload' && !isUploading && !sessionId) {
      getSavedResumes().then((res) => {
        if (res.success && res.data) {
          setSavedResumes(res.data);
          // Check for default
          const defaultResume = res.data.find((r: any) => r.is_default);
          if (defaultResume) {
             handleLoadSavedResume(defaultResume.id, true);
          }
        }
      }).catch(err => console.error("Failed to fetch saved resumes:", err));
    }
  }, [currentStep, isUploading, sessionId]);

  /**
   * Handle file upload.
   * Uploads to backend, receives parsed resume, advances to JD step.
   */
  const handleFileSelect = useCallback(
    async (file: File) => {
      setIsUploading(true);

      // User message
      addMessage({
        type: 'user-upload',
        content: `Uploading resume: ${file.name}`,
        data: { fileName: file.name, fileSize: file.size },
      });

      // System loading message
      addMessage({
        type: 'system-parsing',
        content: 'Parsing your resume and extracting document structure...',
      });

      try {
        const response = await uploadResume(file);

        if (response.success && response.data) {
          const { sessionId: sid, summary } = response.data;
          setSessionId(sid);
          setUploadedFileName(file.name);
          // Determine file type from extension
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          setUploadedFileType(ext === 'pdf' ? 'pdf' : 'docx');

          // Update loading → success
          updateLastSystemMessage({
            type: 'system-parsed',
            content: `Resume parsed successfully!\n\n${summary.fileName}\n${summary.pageCount} page(s) • ${summary.sectionCount} section(s) detected${
              summary.sections.length > 0
                ? `\nSections: ${summary.sections.join(', ')}`
                : ''
            }\n\nNow paste the job description you want to optimize for.`,
          });

          setCurrentStep('job-description');
        } else {
          updateLastSystemMessage({
            type: 'system-error',
            content: `Failed to parse resume: ${response.error?.message || 'Unknown error'}`,
          });
        }
      } catch (error: unknown) {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to upload resume';
        updateLastSystemMessage({
          type: 'system-error',
          content: `Upload failed: ${errorMsg}\n\nPlease try again.`,
        });
      } finally {
        setIsUploading(false);
      }
    },
    [addMessage, updateLastSystemMessage]
  );

  /**
   * Handle loading a saved resume from the dashboard.
   */
  const handleLoadSavedResume = useCallback(
    async (resumeId: string, isAutoLoad = false) => {
      setIsUploading(true);

      // System message
      if (isAutoLoad) {
        addMessage({
          type: 'system-parsing',
          content: 'Auto-loading your default resume...',
        });
      } else {
        addMessage({
          type: 'system-parsing',
          content: 'Loading your saved resume...',
        });
      }

      try {
        const response = await loadSavedResume(resumeId);

        if (!response.success || !response.data) {
          throw new Error('Failed to load resume');
        }

        const { sessionId: newSessionId, summary } = response.data;

        setSessionId(newSessionId);
        setUploadedFileName(summary.fileName);
        setUploadedFileType(summary.fileType);

        updateLastSystemMessage({
          type: 'system-parsed',
          content: `Resume loaded successfully!\n\n${summary.fileName}\n${summary.pageCount} page(s) • ${summary.sectionCount} section(s) detected\n\nWhat job description are we targeting today?`,
        });

        setCurrentStep('job-description');
      } catch (error) {
        updateLastSystemMessage({
          type: 'system-error',
          content: 'I had trouble loading that resume. Please try again or upload a new one.',
          data: { error: String(error) },
        });
      } finally {
        setIsUploading(false);
      }
    },
    [addMessage, updateLastSystemMessage]
  );

  /**
   * Handle sending a message.
   * Job Description step: Analyzes resume
   * Reviewing/Complete step: Processes natural language edits
   */
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!sessionId) return;

      if (currentStep === 'reviewing') {
        // --- AI Chat Edit Mode ---
        setIsProcessing(true);

        addMessage({
          type: 'user-edit',
          content: message,
        });

        addMessage({
          type: 'system-editing',
          content: 'Processing your edit command...',
        });

        try {
          const response = await sendChatEdit(sessionId, message);
          
          if (response.success && response.data) {
            const { message: aiMessage, editsApplied, appliedCount, downloadUrl } = response.data;
            
            let content = aiMessage;
            if (editsApplied.length > 0) {
              content += '\n\n**Actions taken:**\n' + editsApplied.map((e: string) => `• ${e}`).join('\n');
            }

            // Build absolute download URLs
            const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
            const absDownloadUrl = downloadUrl ? (downloadUrl.startsWith('http') ? downloadUrl : `${baseUrl}${downloadUrl}`) : undefined;

            updateLastSystemMessage({
              type: 'system-edited',
              content,
              data: absDownloadUrl ? {
                downloadUrl: absDownloadUrl,
              } : undefined,
            });

            if (appliedCount > 0) {
              incrementDocumentVersion();
            }
          } else {
            updateLastSystemMessage({
              type: 'system-error',
              content: `Failed to process edit: ${response.error?.message || 'Unknown error'}`,
            });
          }
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'Edit failed';
          updateLastSystemMessage({
            type: 'system-error',
            content: `Edit error: ${errorMsg}\n\nPlease try again.`,
          });
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      if (currentStep === 'job-description' || currentStep === 'complete') {
        // --- Job Description Analysis Mode ---
        setIsProcessing(true);

        // User message
        addMessage({
          type: 'user-jd',
          content:
            message.length > 500
              ? `${message.slice(0, 500)}...\n\n(${message.length} characters total)`
              : message,
        });

        // System loading message
        addMessage({
          type: 'system-analyzing',
          content:
            'Analyzing your resume against the job description...\nThis may take a moment.',
        });

        try {
          const response = await analyzeResume(sessionId, message, optimizationMode);

          if (response.success && response.data) {
            const { result } = response.data;
            setOptimizationResult(result);

            // Initialize all change decisions to 'pending'
            const initialDecisions = new Map<string, ChangeStatus>();
            result.changes.forEach((c: any) => initialDecisions.set(c.id, 'pending'));
            setChangeDecisions(initialDecisions);

            // Build a human-readable summary
            const { analysis, changes } = result;
            const summaryParts = [
              `**ATS Compatibility Score: ${analysis.overallScore}%**`,
              '',
            ];

            if (analysis.matchedKeywords.length > 0) {
              summaryParts.push(
                `Matched keywords (${analysis.matchedKeywords.length}): ${analysis.matchedKeywords.slice(0, 10).join(', ')}${analysis.matchedKeywords.length > 10 ? '...' : ''}`
              );
            }
            if (analysis.missingKeywords.length > 0) {
              summaryParts.push(
                `Missing keywords (${analysis.missingKeywords.length}): ${analysis.missingKeywords.slice(0, 10).join(', ')}${analysis.missingKeywords.length > 10 ? '...' : ''}`
              );
            }
            if (analysis.missingSkills.length > 0) {
              summaryParts.push(
                `Missing skills: ${analysis.missingSkills.join(', ')}`
              );
            }
            if (changes.length > 0) {
              summaryParts.push('');
              summaryParts.push(
                `${changes.length} change(s) recommended:`
              );
              const additions = changes.filter((c: any) => c.type === 'addition').length;
              const modifications = changes.filter((c: any) => c.type === 'modification').length;
              const removals = changes.filter((c: any) => c.type === 'removal').length;
              if (additions) summaryParts.push(`   • ${additions} addition(s)`);
              if (modifications) summaryParts.push(`   • ${modifications} modification(s)`);
              if (removals) summaryParts.push(`   • ${removals} suggested removal(s)`);
              summaryParts.push('');
              summaryParts.push('Review each change below and approve or reject it.');
            } else {
              summaryParts.push('');
              summaryParts.push('No changes recommended. Your resume is fully optimized for this role.');
            }

            updateLastSystemMessage({
              type: 'system-analysis',
              content: summaryParts.join('\n'),
              data: { result },
            });

            setCurrentStep(changes.length > 0 ? 'reviewing' : 'complete');
          } else {
            updateLastSystemMessage({
              type: 'system-error',
              content: `Analysis failed: ${response.error?.message || 'Unknown error'}`,
            });
          }
        } catch (error: unknown) {
          const errorMsg =
            error instanceof Error ? error.message : 'Analysis failed';
          updateLastSystemMessage({
            type: 'system-error',
            content: `Analysis error: ${errorMsg}\n\nPlease try again.`,
          });
        } finally {
          setIsProcessing(false);
        }
      }
    },
    [currentStep, sessionId, optimizationMode, addMessage, updateLastSystemMessage, incrementDocumentVersion]
  );

  /** Approve a single change. */
  const handleApproveChange = useCallback((id: string) => {
    setChangeDecisions((prev) => {
      const next = new Map(prev);
      next.set(id, 'approved');
      return next;
    });
  }, []);

  /** Reject a single change. */
  const handleRejectChange = useCallback((id: string) => {
    setChangeDecisions((prev) => {
      const next = new Map(prev);
      next.set(id, 'rejected');
      return next;
    });
  }, []);

  /** Approve all pending changes. */
  const handleApproveAll = useCallback(() => {
    setChangeDecisions((prev) => {
      const next = new Map(prev);
      next.forEach((_, key) => next.set(key, 'approved'));
      return next;
    });
  }, []);

  /** Reject all pending changes. */
  const handleRejectAll = useCallback(() => {
    setChangeDecisions((prev) => {
      const next = new Map(prev);
      next.forEach((_, key) => next.set(key, 'rejected'));
      return next;
    });
  }, []);

  /** Update the user-edited proposed text for a change. */
  const handleEditProposed = useCallback((id: string, text: string) => {
    setEditedProposed((prev) => {
      const next = new Map(prev);
      next.set(id, text);
      return next;
    });
  }, []);

  /**
   * Apply approved changes — calls the backend to patch the document.
   * For DOCX: generates a downloadable file.
   * For PDF: just marks the flow as complete (user applies manually).
   */
  const handleApplyChanges = useCallback(async () => {
    if (!sessionId || !optimizationResult) return;

    setIsApplying(true);

    addMessage({
      type: 'system-applying',
      content: uploadedFileType === 'pdf'
        ? 'Finalizing your change review...'
        : 'Applying approved changes to your resume...',
    });

    try {
      const decisions = Array.from(changeDecisions.entries()).map(
        ([changeId, status]) => {
          const edited = editedProposed.get(changeId);
          return {
            changeId,
            status: status as 'approved' | 'rejected',
            ...(edited !== undefined ? { editedProposed: edited } : {}),
          };
        }
      );

      const response = await applyChanges(sessionId, decisions);

      if (response.success && response.data) {
        const { appliedCount, rejectedCount, finalScore, downloadUrl } =
          response.data;

        const isPdf = uploadedFileType === 'pdf';

        const completeParts = [
          'Optimization Complete!',
          '',
          `Final ATS Score: ${finalScore}%`,
          `${appliedCount} change(s) applied`,
          `${rejectedCount} change(s) rejected`,
        ];

        if (isPdf) {
          completeParts.push('');
          completeParts.push(
            'Since your resume is a PDF, please manually apply the approved changes shown above.'
          );
        } else {
          completeParts.push('');
          completeParts.push(
            'Your optimized resume is ready for download!'
          );
        }

        // Build absolute download URL pointing to backend
        const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
        const absoluteDownloadUrl = downloadUrl.startsWith('http') ? downloadUrl : `${baseUrl}${downloadUrl}`;
        const absolutePdfDownloadUrl = downloadUrl ? (downloadUrl.startsWith('http') ? `${downloadUrl}/pdf` : `${baseUrl}${downloadUrl}/pdf`) : '';

        updateLastSystemMessage({
          type: 'system-complete',
          content: completeParts.join('\n'),
          data: isPdf ? undefined : { downloadUrl: absoluteDownloadUrl, pdfDownloadUrl: absolutePdfDownloadUrl },
        });

        setCurrentStep('complete');
      } else {
        updateLastSystemMessage({
          type: 'system-error',
          content: `Failed to apply changes: ${response.error?.message || 'Unknown error'}`,
        });
      }
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to apply changes';
      updateLastSystemMessage({
        type: 'system-error',
        content: `Apply error: ${errorMsg}\n\nPlease try again.`,
      });
    } finally {
      setIsApplying(false);
    }
  }, [
    sessionId,
    optimizationResult,
    changeDecisions,
    editedProposed,
    uploadedFileType,
    addMessage,
    updateLastSystemMessage,
  ]);

  return {
    messages,
    currentStep,
    isUploading,
    isProcessing,
    isApplying,
    uploadedFileName,
    uploadedFileType,
    sessionId,
    documentVersion,
    incrementDocumentVersion,
    optimizationResult,
    changeDecisions,
    optimizationMode,
    savedResumes,
    setOptimizationMode,
    handleFileSelect,
    handleLoadSavedResume,
    handleSendMessage,
    handleApproveChange,
    handleRejectChange,
    handleApproveAll,
    handleRejectAll,
    handleApplyChanges,
    editedProposed,
    handleEditProposed,
  };
}
