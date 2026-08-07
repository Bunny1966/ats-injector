import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, LogOut, UploadCloud } from 'lucide-react'
import ResumeList from './ResumeList'
import DashboardUploader from './DashboardUploader'

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // We will fetch resumes from the backend via an API call later
  // For now, we'll fetch them directly from Supabase since they are stored there
  const { data: resumes } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-transparent p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Your Resumes</h2>
            {resumes && resumes.length > 0 && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${resumes.length >= 5 ? 'bg-red-500/10 text-red-500' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}>
                {resumes.length} / 5 Uploaded
              </span>
            )}
          </div>
          {resumes && resumes.length >= 5 ? (
            <div className="flex items-center gap-3">
              <span
                title="You have reached the maximum limit of 5 resumes. Please delete one first."
                className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-[var(--text-muted)] bg-[var(--bg-elevated)] cursor-not-allowed transition-all"
              >
                <UploadCloud className="h-4 w-4" />
                Upload Resume
              </span>
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all bg-[var(--accent-primary)] shadow-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/90 hover:shadow-[var(--accent-primary)]/40"
              >
                New Optimization
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <DashboardUploader disabled={false} />
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all bg-[var(--accent-primary)] shadow-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/90 hover:shadow-[var(--accent-primary)]/40"
              >
                New Optimization
              </Link>
            </div>
          )}
        </div>

        {resumes && resumes.length > 0 ? (
          <ResumeList initialResumes={resumes as any} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)]">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No resumes yet</h3>
            <p className="mb-6 max-w-sm text-sm text-[var(--text-secondary)]">
              You haven't uploaded any resumes yet. Click the button below to add your first one.
            </p>
            <DashboardUploader disabled={false} />
          </div>
        )}
      </div>
    </div>
  )
}
