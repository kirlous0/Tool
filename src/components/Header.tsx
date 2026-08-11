import React from 'react';
import { AppStep } from '../types';
import { FolderGit2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentStep: AppStep;
  onReset: () => void;
}

const STEPS: { id: AppStep; label: string; number: number }[] = [
  { id: 'upload', label: 'Upload ZIP', number: 1 },
  { id: 'root-detection', label: 'Project Root', number: 2 },
  { id: 'file-review', label: 'File Review', number: 3 },
  { id: 'github-config', label: 'GitHub Setup', number: 4 },
  { id: 'uploading', label: 'Uploading', number: 5 },
  { id: 'completed', label: 'Verified', number: 6 },
];

export const Header: React.FC<HeaderProps> = ({ currentStep, onReset }) => {
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={onReset}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-900/30">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight flex items-center gap-2">
                ZipToGitHub
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Client-Side
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Convert project ZIP archives to new GitHub repositories
              </p>
            </div>
          </div>

          {/* Reset Action */}
          {currentStep !== 'upload' && (
            <button
              onClick={onReset}
              className="text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Start Over</span>
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <nav className="flex items-center min-w-max gap-2 text-xs">
            {STEPS.map((step, idx) => {
              const isPassed = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <React.Fragment key={step.id}>
                  {idx > 0 && (
                    <div
                      className={`h-0.5 w-4 sm:w-8 transition-colors ${
                        isPassed ? 'bg-cyan-500' : 'bg-slate-800'
                      }`}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-all ${
                      isCurrent
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 ring-2 ring-cyan-500/10'
                        : isPassed
                        ? 'text-cyan-400 hover:text-cyan-300'
                        : 'text-slate-500'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-cyan-500 text-slate-950'
                          : isPassed
                          ? 'bg-cyan-950 text-cyan-400 border border-cyan-700'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-3 h-3 text-cyan-400" /> : step.number}
                    </span>
                    <span>{step.label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
