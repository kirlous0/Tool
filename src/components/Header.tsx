import React from 'react';
import { AppStep } from '../types';
import { FolderGit2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentStep: AppStep;
  onReset: () => void;
}

const getStepLabel = (step: AppStep): string => {
  switch (step) {
    case 'upload':
      return 'Upload ZIP';
    case 'root-detection':
      return 'Project Root';
    case 'file-review':
      return 'File Review';
    case 'github-config':
      return 'New Repo Config';
    case 'repo-selection':
      return 'Select Repo';
    case 'diff-review':
      return 'Review Diff';
    case 'uploading':
      return 'Uploading';
    case 'completed':
      return 'Verified';
    default:
      return 'Step';
  }
};

export const Header: React.FC<HeaderProps> = ({ currentStep, onReset }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={onReset}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-sky-950/40">
              <FolderGit2 className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight flex items-center gap-2">
                ZipToGitHub
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800">
                  Client-Side
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Create new or update existing GitHub repositories directly from ZIP archives
              </p>
            </div>
          </div>

          {/* Current Step Pill */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden md:inline">Current Stage:</span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30">
              {getStepLabel(currentStep)}
            </span>

            {/* Reset Action */}
            {currentStep !== 'upload' && (
              <button
                onClick={onReset}
                className="text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5 ml-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Start Over</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

