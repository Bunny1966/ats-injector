'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Star, Trash2, Loader2 } from 'lucide-react';
import { deleteSavedResume, setDefaultResume, type SavedResume } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ResumeList({ initialResumes }: { initialResumes: SavedResume[] }) {
  const [resumes, setResumes] = useState(initialResumes);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();

  const handleSetDefault = async (id: string, isDefault: boolean) => {
    setLoadingId(id);
    try {
      await setDefaultResume(id, isDefault);
      setResumes(resumes.map((r: any) => ({ ...r, is_default: r.id === id ? isDefault : (isDefault ? false : r.is_default) })));
      router.refresh();
    } catch (error: any) {
      console.error('Failed to set default', error);
      alert(error?.response?.data?.error || error.message || 'Failed to set default resume');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    
    setLoadingId(id);
    try {
      await deleteSavedResume(id);
      setResumes(resumes.filter((r: any) => r.id !== id));
      router.refresh();
    } catch (error) {
      console.error('Failed to delete', error);
      alert('Failed to delete resume');
    } finally {
      setLoadingId(null);
    }
  };

  if (resumes.length === 0) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {resumes.map((resume: any) => (
        <div
          key={resume.id}
          className={`group relative flex flex-col justify-between glass-card p-6 transition-all ${
            resume.is_default 
              ? 'ring-2 ring-[var(--accent-primary)]/50' 
              : ''
          }`}
        >


          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg truncate pr-8" title={resume.file_name}>
                {resume.file_name}
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Created on {new Date(resume.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-2">
            <Link href={`/chat?resume_id=${resume.id}`} className="w-full rounded-lg bg-[var(--accent-secondary)]/10 px-4 py-2 text-center text-xs font-medium text-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)]/20 transition-colors">
              Optimize Again
            </Link>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleSetDefault(resume.id, !resume.is_default)}
                disabled={loadingId === resume.id}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                  resume.is_default 
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--text-accent)] hover:bg-[var(--accent-primary)]/20'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--border-default)]'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${resume.is_default ? 'fill-[var(--text-accent)]' : ''}`} />
                {resume.is_default ? 'Default' : 'Set Default'}
              </button>
              
              <button 
                onClick={() => handleDelete(resume.id)}
                disabled={loadingId === resume.id}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-500/10 px-2 py-2 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors"
              >
                {loadingId === resume.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
