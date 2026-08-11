import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  ArrowRightLeft,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  GitCommit,
  Check,
  FileCode,
  Info,
} from 'lucide-react';
import {
  DiffReport,
  DiffType,
  FileDiffItem,
  GitHubRepository,
  UpdateConfig,
  UpdateStrategy,
} from '../types';
import { formatBytes } from '../utils/pathUtils';

interface DiffReviewStepProps {
  selectedRepo: GitHubRepository;
  selectedBranch: string;
  diffReport: DiffReport;
  onConfirmUpdate: (config: UpdateConfig) => void;
  onBack: () => void;
}

export const DiffReviewStep: React.FC<DiffReviewStepProps> = ({
  selectedRepo,
  selectedBranch,
  diffReport,
  onConfirmUpdate,
  onBack,
}) => {
  const [strategy, setStrategy] = useState<UpdateStrategy>('modified-only');
  const [customCommitMessage, setCustomCommitMessage] = useState(
    `Update project - ${new Date().toISOString().split('T')[0]}`
  );

  // Set of deleted file paths user explicitly confirmed to delete
  const [confirmedDeletions, setConfirmedDeletions] = useState<Set<string>>(new Set());

  // Search filter inside change review
  const [searchQuery, setSearchQuery] = useState('');

  // Accordion open states
  const [openSections, setOpenSections] = useState<Record<DiffType, boolean>>({
    new: true,
    modified: true,
    deleted: true,
    unchanged: false,
    renamed: true,
  });

  const toggleSection = (type: DiffType) => {
    setOpenSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleToggleSingleDelete = (path: string) => {
    setConfirmedDeletions((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleKeepAllDeletions = () => {
    setConfirmedDeletions(new Set());
  };

  const handleDeleteAllDeletions = () => {
    const allDeletedPaths = diffReport.deletedFiles.map((f) => f.path);
    setConfirmedDeletions(new Set(allDeletedPaths));
  };

  const handleProceed = () => {
    onConfirmUpdate({
      selectedRepo,
      selectedBranch,
      strategy,
      commitMessage: customCommitMessage,
      deletedFilesToDelete: confirmedDeletions,
      diffReport,
    });
  };

  const filterItems = (items: FileDiffItem[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.path.toLowerCase().includes(q) ||
        (item.oldPath && item.oldPath.toLowerCase().includes(q))
    );
  };

  const filteredNew = filterItems(diffReport.newFiles);
  const filteredModified = filterItems(diffReport.modifiedFiles);
  const filteredDeleted = filterItems(diffReport.deletedFiles);
  const filteredUnchanged = filterItems(diffReport.unchangedFiles);
  const filteredRenamed = filterItems(diffReport.renamedFiles);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-sky-400" />
            <span>Repository Update Review</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Updating <span className="text-sky-400 font-mono font-medium">{selectedRepo.fullName}</span> on branch{' '}
            <span className="text-slate-200 font-mono font-medium">{selectedBranch}</span>
          </p>
        </div>

        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition flex items-center gap-2 border border-slate-700/60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Difference Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">New</span>
            <Plus className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-emerald-300 mt-2 font-mono">
            +{diffReport.newFiles.length}
          </span>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Modified</span>
            <Edit3 className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold text-amber-300 mt-2 font-mono">
            ~{diffReport.modifiedFiles.length}
          </span>
        </div>

        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Deleted</span>
            <Trash2 className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-2xl font-bold text-rose-300 mt-2 font-mono">
            -{diffReport.deletedFiles.length}
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unchanged</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-2xl font-bold text-slate-300 mt-2 font-mono">
            ={diffReport.unchangedFiles.length}
          </span>
        </div>

        <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3.5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Final Total</span>
            <FileCode className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-2xl font-bold text-sky-300 mt-2 font-mono">
            {diffReport.totalFinalFiles}
          </span>
        </div>
      </div>

      {/* Notice on Unchanged Files */}
      {diffReport.unchangedFiles.length > 0 && (
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3.5 text-xs text-sky-300 flex items-center gap-2.5">
          <Info className="w-4 h-4 shrink-0 text-sky-400" />
          <span>
            <strong>{diffReport.unchangedFiles.length} files</strong> are already identical in content hash and will not be re-uploaded.
          </span>
        </div>
      )}

      {/* Change Review Accordion List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-slate-200">Detailed File Comparison</h3>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search changed files..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="space-y-3">
          {/* Renamed Files Section */}
          {diffReport.renamedFiles.length > 0 && (
            <div className="border border-sky-500/30 rounded-xl overflow-hidden bg-sky-950/20">
              <button
                onClick={() => toggleSection('renamed')}
                className="w-full px-4 py-3 bg-sky-900/30 hover:bg-sky-900/40 text-left flex items-center justify-between text-xs font-semibold text-sky-300 transition"
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                  <span>RENAMED FILES ({filteredRenamed.length})</span>
                </div>
                {openSections.renamed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.renamed && (
                <div className="p-2 space-y-1 bg-slate-950/60 max-h-48 overflow-y-auto font-mono text-xs">
                  {filteredRenamed.map((item) => (
                    <div key={item.path} className="px-3 py-1.5 rounded bg-slate-900/80 text-sky-300 flex items-center justify-between">
                      <span className="truncate">
                        <span className="text-slate-500 line-through mr-1">{item.oldPath}</span>
                        <span className="text-sky-400">→</span> {item.path}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(item.size || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Files Section */}
          {diffReport.newFiles.length > 0 && (
            <div className="border border-emerald-500/30 rounded-xl overflow-hidden bg-emerald-950/20">
              <button
                onClick={() => toggleSection('new')}
                className="w-full px-4 py-3 bg-emerald-900/30 hover:bg-emerald-900/40 text-left flex items-center justify-between text-xs font-semibold text-emerald-300 transition"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>NEW FILES ({filteredNew.length})</span>
                </div>
                {openSections.new ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.new && (
                <div className="p-2 space-y-1 bg-slate-950/60 max-h-48 overflow-y-auto font-mono text-xs">
                  {filteredNew.map((item) => (
                    <div key={item.path} className="px-3 py-1.5 rounded bg-slate-900/80 text-emerald-300 flex items-center justify-between">
                      <span className="truncate">+ {item.path}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(item.size || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modified Files Section */}
          {diffReport.modifiedFiles.length > 0 && (
            <div className="border border-amber-500/30 rounded-xl overflow-hidden bg-amber-950/20">
              <button
                onClick={() => toggleSection('modified')}
                className="w-full px-4 py-3 bg-amber-900/30 hover:bg-amber-900/40 text-left flex items-center justify-between text-xs font-semibold text-amber-300 transition"
              >
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>MODIFIED FILES ({filteredModified.length})</span>
                </div>
                {openSections.modified ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.modified && (
                <div className="p-2 space-y-1 bg-slate-950/60 max-h-48 overflow-y-auto font-mono text-xs">
                  {filteredModified.map((item) => (
                    <div key={item.path} className="px-3 py-1.5 rounded bg-slate-900/80 text-amber-300 flex items-center justify-between">
                      <span className="truncate">~ {item.path}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(item.size || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deleted Files Section */}
          {diffReport.deletedFiles.length > 0 && (
            <div className="border border-rose-500/30 rounded-xl overflow-hidden bg-rose-950/20">
              <button
                onClick={() => toggleSection('deleted')}
                className="w-full px-4 py-3 bg-rose-900/30 hover:bg-rose-900/40 text-left flex items-center justify-between text-xs font-semibold text-rose-300 transition"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>DELETED FILES IN ZIP ({filteredDeleted.length})</span>
                </div>
                {openSections.deleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.deleted && (
                <div className="p-2 space-y-1 bg-slate-950/60 max-h-48 overflow-y-auto font-mono text-xs">
                  {filteredDeleted.map((item) => {
                    const isWillDelete = confirmedDeletions.has(item.path);
                    return (
                      <div
                        key={item.path}
                        className={`px-3 py-1.5 rounded flex items-center justify-between ${
                          isWillDelete ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30' : 'bg-slate-900/80 text-slate-400'
                        }`}
                      >
                        <span className="truncate">- {item.path}</span>
                        <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {isWillDelete ? 'Will Delete' : 'Kept on GitHub'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Unchanged Files Section */}
          {diffReport.unchangedFiles.length > 0 && (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              <button
                onClick={() => toggleSection('unchanged')}
                className="w-full px-4 py-3 bg-slate-900/50 hover:bg-slate-900 text-left flex items-center justify-between text-xs font-semibold text-slate-400 transition"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-slate-500" />
                  <span>UNCHANGED FILES ({filteredUnchanged.length})</span>
                </div>
                {openSections.unchanged ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.unchanged && (
                <div className="p-2 space-y-1 bg-slate-950/80 max-h-48 overflow-y-auto font-mono text-xs text-slate-500">
                  {filteredUnchanged.map((item) => (
                    <div key={item.path} className="px-3 py-1.5 rounded bg-slate-900/40 flex items-center justify-between">
                      <span className="truncate">= {item.path}</span>
                      <span className="text-[10px] text-slate-600 shrink-0">{formatBytes(item.size || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Update Strategy Options */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-200">Update Strategy</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label
            className={`p-4 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
              strategy === 'modified-only'
                ? 'bg-sky-500/10 border-sky-500/50 shadow-md shadow-sky-950/20'
                : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/40'
            }`}
          >
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'modified-only'}
              onChange={() => setStrategy('modified-only')}
              className="mt-1 text-sky-500 focus:ring-sky-500"
            />
            <div>
              <div className="text-sm font-semibold text-slate-200">Upload new/modified files only</div>
              <p className="text-xs text-slate-400 mt-1">
                Safest option. Adds new files and updates modified files. Never deletes any files on GitHub.
              </p>
            </div>
          </label>

          <label
            className={`p-4 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
              strategy === 'sync'
                ? 'bg-sky-500/10 border-sky-500/50 shadow-md shadow-sky-950/20'
                : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/40'
            }`}
          >
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'sync'}
              onChange={() => setStrategy('sync')}
              className="mt-1 text-sky-500 focus:ring-sky-500"
            />
            <div>
              <div className="text-sm font-semibold text-slate-200">Synchronize repository with new ZIP</div>
              <p className="text-xs text-slate-400 mt-1">
                Allows removing missing files from GitHub after explicit confirmation.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Deletion Safety Confirmation Section */}
      {strategy === 'sync' && diffReport.deletedFiles.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-rose-300">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold">⚠ Files Removed From Local Project</h3>
              <p className="text-xs text-rose-400/90 mt-0.5">
                The following {diffReport.deletedFiles.length} file(s) exist on GitHub but were removed from your new project. Default is <strong>KEEP</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleKeepAllDeletions}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Keep All Deleted Files
            </button>
            <button
              type="button"
              onClick={handleDeleteAllDeletions}
              className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 text-xs font-semibold border border-rose-500/30 transition"
            >
              Delete All Removed Files
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 font-mono text-xs pr-1">
            {diffReport.deletedFiles.map((file) => {
              const isMarkedDelete = confirmedDeletions.has(file.path);
              return (
                <div
                  key={file.path}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <span className="text-slate-300 truncate">{file.path}</span>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSingleDelete(file.path)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                        isMarkedDelete
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {isMarkedDelete ? (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete from GitHub</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Keep on GitHub</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Commit Message Input */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
        <label className="block text-sm font-semibold text-slate-200 flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-sky-400" />
          <span>Commit Message</span>
        </label>
        <input
          type="text"
          value={customCommitMessage}
          onChange={(e) => setCustomCommitMessage(e.target.value)}
          placeholder="Enter commit message..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
        />
      </div>

      {/* Final Action Bar */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Repository Selection</span>
        </button>

        <button
          onClick={handleProceed}
          className="px-8 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-sky-950/40 flex items-center gap-2"
        >
          <span>Apply Changes to GitHub</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
