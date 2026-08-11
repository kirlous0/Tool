import React, { useState, useMemo } from 'react';
import { ExtractedFileItem } from '../types';
import { formatBytes } from '../utils/pathUtils';
import {
  FolderTree,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Lock,
  XCircle,
  Folder,
  FileCode,
  FileText,
  FileImage,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ShieldAlert,
  Info,
  CheckSquare,
  Square,
  Eye,
  EyeOff
} from 'lucide-react';

interface FileReviewStepProps {
  files: ExtractedFileItem[];
  onToggleExcludeFile: (id: string) => void;
  onToggleExcludeAllRecommended: (exclude: boolean) => void;
  onConfirm: () => void;
  onBackToRoot: () => void;
}

export const FileReviewStep: React.FC<FileReviewStepProps> = ({
  files,
  onToggleExcludeFile,
  onToggleExcludeAllRecommended,
  onConfirm,
  onBackToRoot,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showSensitiveConfirmModal, setShowSensitiveConfirmModal] = useState(false);
  const [allowSensitive, setAllowSensitive] = useState(false);
  const [previewSensitiveFile, setPreviewSensitiveFile] = useState<ExtractedFileItem | null>(null);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalSize = 0;
    let includedCount = 0;
    let includedSize = 0;
    let excludedCount = 0;
    let sensitiveCount = 0;
    let recommendedExcludeCount = 0;
    let errorCount = 0;

    files.forEach((f) => {
      totalSize += f.size;
      if (f.status === 'sensitive') sensitiveCount++;
      if (f.isRecommendedExclude) recommendedExcludeCount++;
      if (f.status === 'error') errorCount++;

      if (!f.isExcluded && (f.status !== 'sensitive' || allowSensitive) && f.status !== 'error') {
        includedCount++;
        includedSize += f.size;
      } else {
        excludedCount++;
      }
    });

    return {
      totalCount: files.length,
      totalSize,
      includedCount,
      includedSize,
      excludedCount,
      sensitiveCount,
      recommendedExcludeCount,
      errorCount,
    };
  }, [files, allowSensitive]);

  // Build tree hierarchy for display
  const treeNodes = useMemo(() => {
    interface TreeNode {
      name: string;
      fullPath: string;
      isDir: boolean;
      children: Record<string, TreeNode>;
      fileItem?: ExtractedFileItem;
    }

    const root: Record<string, TreeNode> = {};

    files.forEach((file) => {
      if (searchQuery && !file.normalizedPath.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }

      const parts = file.normalizedPath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (!current[part]) {
          current[part] = {
            name: part,
            fullPath: currentPath,
            isDir: !isLast,
            children: {},
            fileItem: isLast ? file : undefined,
          };
        }

        if (!isLast) {
          current = current[part].children;
        }
      }
    });

    return root;
  }, [files, searchQuery]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const getFileIcon = (fileName: string, isBinary: boolean) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (isBinary || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(ext || '')) {
      return <FileImage className="w-4 h-4 text-purple-400 shrink-0" />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'json', 'html', 'css', 'py', 'go', 'rs', 'java', 'c', 'cpp'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  // Render tree recursively
  const renderTree = (nodes: Record<string, any>, depth: number = 0) => {
    return Object.keys(nodes).map((key) => {
      const node = nodes[key];

      if (node.isDir) {
        // Default folders expanded if depth < 2 or searching
        const isExpanded = searchQuery ? true : expandedFolders[node.fullPath] ?? depth < 2;

        return (
          <div key={node.fullPath} className="select-none">
            <div
              onClick={() => toggleFolder(node.fullPath)}
              className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-800/60 rounded-lg cursor-pointer text-xs font-mono text-slate-200"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
              <Folder className="w-4 h-4 text-cyan-400 fill-cyan-950/80" />
              <span className="font-medium text-slate-100">{node.name}</span>
            </div>

            {isExpanded && renderTree(node.children, depth + 1)}
          </div>
        );
      }

      // File Node
      const f: ExtractedFileItem | undefined = node.fileItem;
      if (!f) return null;

      const isExcluded = f.isExcluded || (f.status === 'sensitive' && !allowSensitive) || f.status === 'error';

      return (
        <div
          key={f.id}
          className={`flex items-center justify-between gap-3 py-1.5 px-2 hover:bg-slate-800/80 rounded-lg text-xs font-mono transition ${
            isExcluded ? 'opacity-50 line-through' : 'text-slate-200'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => onToggleExcludeFile(f.id)}
              className="text-slate-500 hover:text-cyan-400 focus:outline-none"
            >
              {!isExcluded ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {getFileIcon(f.fileName, f.isBinary)}
            <span className="truncate">{f.fileName}</span>
            <span className="text-[10px] text-slate-500 shrink-0 font-sans">({formatBytes(f.size)})</span>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 shrink-0">
            {f.status === 'ready' && !f.isRecommendedExclude && (
              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            )}

            {f.isRecommendedExclude && (
              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Exclude
              </span>
            )}

            {f.status === 'sensitive' && (
              <button
                onClick={() => setPreviewSensitiveFile(f)}
                className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-rose-950/80 text-rose-300 border border-rose-800 flex items-center gap-1 hover:bg-rose-900"
              >
                <Lock className="w-3 h-3" /> Sensitive
              </button>
            )}

            {f.status === 'error' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-red-950/80 text-red-300 border border-red-800 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Cannot Upload
              </span>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Title & Stats */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-cyan-400" />
            Repository File Review
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Inspect exact paths and files that will be committed to GitHub.
          </p>
        </div>

        {/* Quick Exclude All Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleExcludeAllRecommended(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 text-xs font-medium transition flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Exclude Dependencies (node_modules, build)
          </button>
          <button
            onClick={() => onToggleExcludeAllRecommended(false)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
          >
            Include All
          </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 font-medium block">Total Files</span>
          <span className="text-lg font-bold text-white mt-0.5 block">{stats.totalCount}</span>
          <span className="text-[10px] text-slate-500 font-mono">{formatBytes(stats.totalSize)}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/80">
          <span className="text-xs text-cyan-400 font-medium block">To Upload</span>
          <span className="text-lg font-bold text-cyan-200 mt-0.5 block">{stats.includedCount}</span>
          <span className="text-[10px] text-cyan-400/80 font-mono">{formatBytes(stats.includedSize)}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 font-medium block">Excluded Files</span>
          <span className="text-lg font-bold text-slate-300 mt-0.5 block">{stats.excludedCount}</span>
          <span className="text-[10px] text-slate-500 font-sans">Filtered</span>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/80">
          <span className="text-xs text-rose-400 font-medium block">Sensitive Detected</span>
          <span className="text-lg font-bold text-rose-300 mt-0.5 block">{stats.sensitiveCount}</span>
          <span className="text-[10px] text-rose-400/80 font-sans">
            {allowSensitive ? 'Included' : 'Protected'}
          </span>
        </div>
      </div>

      {/* Sensitive File Warning Banner */}
      {stats.sensitiveCount > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-semibold block">
                {stats.sensitiveCount} potentially sensitive file(s) detected (.env or secret patterns)
              </span>
              <span className="text-slate-300">
                By default, sensitive files are NOT uploaded to GitHub to prevent key leaks.
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (!allowSensitive) {
                setShowSensitiveConfirmModal(true);
              } else {
                setAllowSensitive(false);
              }
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 text-xs flex items-center gap-1.5 ${
              allowSensitive
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {allowSensitive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{allowSensitive ? 'Exclude Sensitive Files' : 'Allow Sensitive Upload'}</span>
          </button>
        </div>
      )}

      {/* File Tree Search & Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mb-8">
        {/* Search Header */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search files and paths..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-200 focus:outline-none font-mono"
          />
        </div>

        {/* Tree Content Area */}
        <div className="p-4 max-h-[420px] overflow-y-auto space-y-1">
          {Object.keys(treeNodes).length > 0 ? (
            renderTree(treeNodes)
          ) : (
            <div className="text-center py-8 text-xs text-slate-500 font-mono">
              No files matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToRoot}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
        >
          ← Change Root Folder
        </button>

        <button
          onClick={onConfirm}
          disabled={stats.includedCount === 0}
          className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold text-sm transition shadow-lg shadow-cyan-950/40 flex items-center gap-2 disabled:opacity-50"
        >
          <span>Continue to GitHub Setup ({stats.includedCount} files)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Sensitive File Preview Drawer / Modal */}
      {previewSensitiveFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <Lock className="w-4 h-4" />
                <span>Sensitive File Details</span>
              </div>
              <button
                onClick={() => setPreviewSensitiveFile(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <span className="text-slate-500 block">Path:</span>
                <span className="text-cyan-300 font-bold">{previewSensitiveFile.normalizedPath}</span>
              </div>

              <div>
                <span className="text-slate-500 block mb-1">Detected Match Types:</span>
                <div className="space-y-1.5">
                  {previewSensitiveFile.sensitiveMatches?.map((m, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-rose-400 font-semibold block">{m.type}</span>
                      <span className="text-slate-400 text-[11px]">Match snippet: {m.maskedSnippet}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setPreviewSensitiveFile(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allow Sensitive Confirmation Modal */}
      {showSensitiveConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-base mb-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <span>Confirm Sensitive Upload</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              You are enabling the upload of sensitive files (e.g. <code className="text-rose-300">.env</code> or credentials).
              If your repository is Public, these secret keys or passwords will be visible to everyone on GitHub.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSensitiveConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel (Keep Excluded)
              </button>

              <button
                onClick={() => {
                  setAllowSensitive(true);
                  setShowSensitiveConfirmModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                I Understand, Allow Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
