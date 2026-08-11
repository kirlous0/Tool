import React from 'react';
import { VerificationResult, GitHubUser, RepoConfig } from '../types';
import { ExternalLink, CheckCircle2, AlertTriangle, Github, RefreshCw, Layers, ShieldCheck, FileCheck } from 'lucide-react';

interface FinalResultStepProps {
  repoUrl: string;
  repoConfig: RepoConfig;
  user: GitHubUser;
  verification: VerificationResult | null;
  uploadedCount: number;
  skippedCount: number;
  failedCount: number;
  onReset: () => void;
}

export const FinalResultStep: React.FC<FinalResultStepProps> = ({
  repoUrl,
  repoConfig,
  user,
  verification,
  uploadedCount,
  skippedCount,
  failedCount,
  onReset,
}) => {
  const isFullyVerified = verification?.verified ?? false;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Hero Success Badge */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-950/50">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Repository Created Successfully!
        </h2>
        <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
          Your project files have been uploaded and verified on GitHub.
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
                <Github className="w-4 h-4 text-cyan-400" />
                <span>
                  {user.login}/{repoConfig.name}
                </span>
              </div>
              <span className="text-xs text-slate-400">{repoConfig.description || 'No description provided'}</span>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              repoConfig.isPrivate
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-emerald-950 text-emerald-400 border-emerald-800'
            }`}
          >
            {repoConfig.isPrivate ? '🔒 Private' : '🌐 Public'}
          </span>
        </div>

        {/* Repository URL Box */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 font-mono text-xs">
          <span className="text-cyan-300 truncate">{repoUrl}</span>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-sans font-semibold text-xs transition flex items-center gap-1.5 shrink-0 shadow-md shadow-cyan-950/40"
          >
            <span>Open Repository</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

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
              <FileCheck
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

          {/* Missing Files Detail if any */}
          {verification.missingFiles.length > 0 && (
            <div className="mt-4 pt-3 border-t border-amber-800/60">
              <span className="text-xs font-semibold text-amber-300 block mb-1">
                Missing File Paths:
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-amber-200">
                {verification.missingFiles.map((f, i) => (
                  <div key={i}>• {f}</div>
                ))}
              </div>
            </div>
          )}
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
