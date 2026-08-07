'use client';

import ChatContainer from '@/components/chat/ChatContainer';
import { useResumeOptimizer } from '@/hooks/useResumeOptimizer';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, Suspense } from 'react';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasLoaded = useRef(false);

  const {
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
  } = useResumeOptimizer();

  useEffect(() => {
    const resumeId = searchParams.get('resume_id');
    if (resumeId && !hasLoaded.current) {
      hasLoaded.current = true;
      handleLoadSavedResume(resumeId).then(() => {
        // Clear the URL parameter so it doesn't reload on refresh
        router.replace('/chat');
      });
    }
  }, [searchParams, handleLoadSavedResume, router]);

  return (
    <main className="flex h-screen flex-col bg-transparent overflow-hidden">
      <ChatContainer
        messages={messages}
        onFileSelect={handleFileSelect}
        onSendMessage={handleSendMessage}
        isUploading={isUploading}
        isProcessing={isProcessing}
        isApplying={isApplying}
        uploadedFileName={uploadedFileName}
        uploadedFileType={uploadedFileType}
        currentStep={currentStep}
        optimizationResult={optimizationResult}
        changeDecisions={changeDecisions}
        optimizationMode={optimizationMode}
        savedResumes={savedResumes}
        onModeChange={setOptimizationMode}
        onSelectSavedResume={handleLoadSavedResume}
        onApproveChange={handleApproveChange}
        onRejectChange={handleRejectChange}
        onApproveAll={handleApproveAll}
        onRejectAll={handleRejectAll}
        onApplyChanges={handleApplyChanges}
        editedProposed={editedProposed}
        onEditProposed={handleEditProposed}
      />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
