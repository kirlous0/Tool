import React from 'react';
import { UploadProgress } from '../types';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  FileText,
  XCircle,
  Key,
} from 'lucide-react';
import { formatBytes } from '../utils/pathUtils';
import { TroubleshootingGuide } from './TroubleshootingGuide';

interface UploadProgressStepProps {
  progress: UploadProgress;
  onRetryFailed: () => void;
  onProceedToVerification: () => void;
  onBackToConfig?: () => void;
}

export const UploadProgressStep: React.FC<UploadProgressStepProps> = ({
  progress,
  onRetryFailed,
  onProceedToVerification,
  onBackToConfig,
}) => {
  const percentage =
    progress.totalFiles > 0
      ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
      : 0;

  const failedFiles = progress.fileResults.filter((f) => f.status === 'failed');

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-white flex items-center justify-center gap-2">
          {progress.status === 'in-progress' && <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />}
          {progress.status === 'completed' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
          {progress.status === 'failed' && <XCircle className="w-6 h-6 text-red-400" />}
          {progress.status === 'paused' && <AlertTriangle className="w-6 h-6 text-amber-400" />}
          <span>Uploading Project to GitHub</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Creating Git Blobs, Tree structures, and initial commit on GitHub...
        </p>
      </div>

      {/* Main Progress Bar Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
          <span>
            {progress.processedFiles} of {progress.totalFiles} files processed
          </span>
          <span className="text-cyan-400 font-mono text-sm">{percentage}%</span>
        </div>

        {/* Outer Bar */}
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Current Active File Banner */}
        <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-2 font-mono text-xs text-slate-300 truncate">
          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-slate-500 shrink-0">Status:</span>
          <span className="text-cyan-300 truncate">{progress.currentFile || 'Preparing upload...'}</span>
        </div>
      </div>

      {/* Progress Breakdown Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-xs text-slate-400 font-medium block">Successful</span>
          <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
            {progress.successfulCount}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-xs text-slate-400 font-medium block">Failed</span>
          <span className="text-xl font-bold text-rose-400 mt-0.5 block">{progress.failedCount}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-xs text-slate-400 font-medium block">Skipped / Excluded</span>
          <span className="text-xl font-bold text-slate-400 mt-0.5 block">
            {progress.skippedCount}
          </span>
        </div>
      </div>

      {/* General Error Banner */}
      {progress.errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-sm">Upload Encountered an Issue</span>
            <p className="text-red-300/90 leading-relaxed font-mono">{progress.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Failed Files Details List */}
      {failedFiles.length > 0 && (
        <div className="bg-slate-900 border border-rose-900/50 rounded-2xl p-4 shadow-xl">
          <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" />
            Failed Files ({failedFiles.length})
          </h3>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {failedFiles.map((f, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between gap-2"
              >
                <div className="truncate text-slate-200">
                  <span className="text-cyan-300 font-bold block">{f.path}</span>
                  <span className="text-slate-500 text-[10px]">{formatBytes(f.size)}</span>
                </div>
                <span className="text-rose-400 text-[11px] font-sans text-right shrink-0">
                  {f.error || 'Blob error'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={onRetryFailed}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Failed Files</span>
            </button>
          </div>
        </div>
      )}

      {/* Proceed Actions */}
      {(progress.status === 'completed' || progress.status === 'paused') && (
        <div className="flex justify-end pt-2">
          <button
            onClick={onProceedToVerification}
            className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition shadow-lg shadow-cyan-950/40 flex items-center gap-2"
          >
            <span>Proceed to Repository Verification</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {progress.status === 'failed' && (
        <div className="flex items-center justify-between gap-4 pt-2">
          {onBackToConfig && (
            <button
              onClick={onBackToConfig}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Change Settings / Token</span>
            </button>
          )}

          <button
            onClick={onRetryFailed}
            className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition shadow-lg shadow-rose-950/40 flex items-center gap-2 ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Upload Again</span>
          </button>
        </div>
      )}

      {/* Show troubleshooting guide on failure or warning */}
      {progress.status === 'failed' && (
        <TroubleshootingGuide defaultExpanded={true} />
      )}
    </div>
  );
};
