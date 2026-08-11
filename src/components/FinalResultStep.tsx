import React from 'react';
import { VerificationResult, GitHubUser, RepoConfig, AppMode, UpdateConfig } from '../types';
import { ExternalLink, CheckCircle2, AlertTriangle, Github, RefreshCw, GitCommit, Plus, Edit3, Trash2, CheckCircle, ShieldCheck } from 'lucide-react';

interface FinalResultStepProps {
  appMode: AppMode;
  repoUrl: string;
  repoConfig: RepoConfig;
  user: GitHubUser;
  verification: VerificationResult | null;
  uploadedCount: number;
  skippedCount: number;
  failedCount: number;
  updateConfig?: UpdateConfig | null;
  commitSha?: string;
  onReset: () => void;
}

export const FinalResultStep: React.FC<FinalResultStepProps> = ({
  appMode,
  repoUrl,
  repoConfig,
  user,
  verification,
  uploadedCount,
  skippedCount,
  failedCount,
  updateConfig,
  commitSha,
  onReset,
}) => {
  const isFullyVerified = verification?.verified ?? false;
  const isUpdate = appMode === 'update';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Hero Success Badge */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-950/50">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {isUpdate ? 'Repository Updated Successfully!' : 'Repository Created Successfully!'}
        </h2>
        <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
          {isUpdate
            ? 'Your project changes have been safely committed and verified on GitHub.'
            : 'Your project files have been uploaded and verified on GitHub.'}
        </p>
      </div>

      {/* Main Repository Link Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl mb-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={user.avatarUrl}
              alt={user.login}
              className="w-10 h-10 rounded-full border border-slate-700"
            />
            <div>
              <div className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                <Github className="w-4 h-4 text-sky-400" />
                <span>
                  {isUpdate && updateConfig ? updateConfig.selectedRepo.fullName : `${user.login}/${repoConfig.name}`}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {isUpdate && updateConfig
                  ? `Branch: ${updateConfig.selectedBranch}`
                  : repoConfig.description || 'No description provided'}
              </span>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              (isUpdate && updateConfig?.selectedRepo.isPrivate) || (!isUpdate && repoConfig.isPrivate)
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-emerald-950 text-emerald-400 border-emerald-800'
            }`}
          >
            {(isUpdate && updateConfig?.selectedRepo.isPrivate) || (!isUpdate && repoConfig.isPrivate)
              ? '🔒 Private'
              : '🌐 Public'}
          </span>
        </div>

        {/* Repository URL Box */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 font-mono text-xs">
          <span className="text-sky-300 truncate">{repoUrl}</span>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-sans font-semibold text-xs transition flex items-center gap-1.5 shrink-0 shadow-md shadow-sky-950/40"
          >
            <span>Open GitHub Repository</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Update Mode Details (Section 44 Breakdown) */}
      {isUpdate && updateConfig && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-sky-400" />
            <span>Update Change Breakdown</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
              <span className="text-slate-400 text-[10px] block font-sans">Added</span>
              <span className="text-emerald-400 font-bold text-base">
                +{updateConfig.diffReport.newFiles.length}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30">
              <span className="text-slate-400 text-[10px] block font-sans font-medium">Modified</span>
              <span className="text-amber-400 font-bold text-base">
                ~{updateConfig.diffReport.modifiedFiles.length}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30">
              <span className="text-slate-400 text-[10px] block font-sans">Deleted</span>
              <span className="text-rose-400 font-bold text-base">
                -{updateConfig.deletedFilesToDelete.size}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[10px] block font-sans">Unchanged</span>
              <span className="text-slate-300 font-bold text-base">
                ={updateConfig.diffReport.unchangedFiles.length}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-xs">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Commit Message:</span>
              <span className="text-sky-300 font-semibold">{updateConfig.commitMessage}</span>
            </div>
            {commitSha && (
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span className="text-slate-500">Commit SHA:</span>
                <span>{commitSha.substring(0, 7)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verification Results Card */}
      {verification && (
        <div
          className={`rounded-2xl p-6 border mb-6 ${
            isFullyVerified
              ? 'bg-emerald-950/20 border-emerald-800/80'
              : 'bg-amber-950/20 border-amber-800/80'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`w-5 h-5 ${isFullyVerified ? 'text-emerald-400' : 'text-amber-400'}`}
              />
              <h3 className="text-sm font-bold text-white">Tree Verification Report</h3>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isFullyVerified
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}
            >
              {isFullyVerified ? '✓ Verified Passed' : '⚠ Verification Warning'}
            </span>
          </div>

          <p className="text-xs text-slate-300 mb-4">{verification.message}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-[10px] block font-sans">Uploaded</span>
              <span className="text-white font-bold">{uploadedCount} files</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-[10px] block font-sans">Remote Tree</span>
              <span className="text-emerald-400 font-bold">{verification.actualCount} files</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-[10px] block font-sans">Missing</span>
              <span className="text-rose-400 font-bold">{verification.missingFiles.length} files</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-[10px] block font-sans">Skipped</span>
              <span className="text-slate-400 font-bold">{skippedCount} files</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={onReset}
          className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Upload Another Project ZIP</span>
        </button>
      </div>
    </div>
  );
};

