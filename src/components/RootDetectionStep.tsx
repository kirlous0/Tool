import React from 'react';
import { CandidateRoot } from '../types';
import { Folder, AlertTriangle, CheckCircle, ArrowRight, Info, Layers } from 'lucide-react';

interface RootDetectionStepProps {
  zipName: string;
  detectedRoot: CandidateRoot;
  candidateRoots: CandidateRoot[];
  hasMultipleRoots: boolean;
  selectedRootPath: string;
  onSelectRootPath: (path: string) => void;
  preserveFolder: boolean;
  onTogglePreserveFolder: (preserve: boolean) => void;
  onConfirm: () => void;
  warningMessage?: string;
}

export const RootDetectionStep: React.FC<RootDetectionStepProps> = ({
  zipName,
  detectedRoot,
  candidateRoots,
  hasMultipleRoots,
  selectedRootPath,
  onSelectRootPath,
  preserveFolder,
  onTogglePreserveFolder,
  onConfirm,
  warningMessage,
}) => {
  const currentRoot = candidateRoots.find((c) => c.path === selectedRootPath) || detectedRoot;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Folder className="w-6 h-6 text-cyan-400" />
          Project Root Detection
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Review detected project structure inside <span className="font-mono text-cyan-300">{zipName}</span>.
        </p>
      </div>

      {/* Multiple Roots Warning Banner */}
      {(hasMultipleRoots || warningMessage) && (
        <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Project Root Notice</span>
            <span>{warningMessage || 'Multiple potential project directories were detected in this ZIP archive.'}</span>
          </div>
        </div>
      )}

      {/* Primary Root Selector Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Selected Project Root
            </span>
            <div className="text-lg font-bold text-cyan-300 font-mono mt-0.5 flex items-center gap-2">
              <Folder className="w-5 h-5 text-cyan-400 fill-cyan-950" />
              <span>{currentRoot.path ? currentRoot.path : 'ZIP Root (No subfolder)'}</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Score: {currentRoot.indicatorScore}
          </span>
        </div>

        {/* Indicators list */}
        {currentRoot.indicatorsFound.length > 0 && (
          <div className="mb-5">
            <span className="text-xs font-medium text-slate-400 block mb-2">
              Detected Project Root Indicators:
            </span>
            <div className="flex flex-wrap gap-2">
              {currentRoot.indicatorsFound.map((ind, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  {ind}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Manual Root Selector Dropdown / Options */}
        {candidateRoots.length > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Change Project Root Folder:
            </label>
            <select
              value={selectedRootPath}
              onChange={(e) => onSelectRootPath(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
            >
              {candidateRoots.map((cand) => (
                <option key={cand.path} value={cand.path}>
                  {cand.path ? `📁 ${cand.path}` : '📦 ZIP Root (No subfolder)'} — ({cand.fileCount} files, Score: {cand.indicatorScore})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Root Normalization Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-800 text-cyan-400 shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Preserve top-level folder</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Default (OFF): Selected root folder contents become repository root.
                <br />
                ON: Keep <span className="font-mono text-cyan-300">{currentRoot.name || 'folder'}</span> as a subfolder in the repository.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={preserveFolder}
              onChange={(e) => onTogglePreserveFolder(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
        </div>

        {/* Structure Preview Comparison */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300">
          <span className="text-slate-500 block mb-1 font-sans text-[11px] font-semibold">
            Repository Structure Preview:
          </span>
          {preserveFolder ? (
            <div className="space-y-1 text-cyan-300">
              <div>📁 {currentRoot.name || 'project'}/</div>
              <div className="pl-4">├── index.html</div>
              <div className="pl-4">├── package.json</div>
              <div className="pl-4">└── src/</div>
            </div>
          ) : (
            <div className="space-y-1 text-emerald-300">
              <div>├── index.html</div>
              <div>├── package.json</div>
              <div>└── src/</div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onConfirm}
          className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold text-sm transition shadow-lg shadow-cyan-950/40 flex items-center gap-2"
        >
          <span>Confirm Root & Review Files</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
