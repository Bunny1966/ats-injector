'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, UploadCloud } from 'lucide-react';
import { uploadResume } from '@/lib/api';

export default function DashboardUploader({ disabled }: { disabled: boolean }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: add validation for docx/pdf
    if (!file.name.endsWith('.docx') && !file.name.endsWith('.pdf')) {
      alert('Please upload a .docx or .pdf file.');
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadResume(file);
      if (response.success) {
        // Clear the input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Refresh the dashboard to show the new resume
        router.refresh();
      } else {
        alert(response.error || 'Failed to upload resume');
      }
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to upload resume. Limit may be reached.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all ${
          disabled
            ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed shadow-none'
            : 'bg-white text-black shadow-lg hover:bg-gray-100 hover:shadow-xl'
        }`}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        {isUploading ? 'Uploading...' : 'Upload Resume'}
      </button>
    </>
  );
}
