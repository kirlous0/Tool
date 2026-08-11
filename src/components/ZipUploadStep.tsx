import React, { useRef, useState } from 'react';
import { Upload, FileArchive, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { formatBytes } from '../utils/pathUtils';

interface ZipUploadStepProps {
  onFileSelected: (file: File) => void;
  isExtracting: boolean;
  extractionError: string | null;
}

export const ZipUploadStep: React.FC<ZipUploadStepProps> = ({
  onFileSelected,
  isExtracting,
  extractionError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Please select a valid .zip file archive.');
      return;
    }
    setSelectedFile(file);
    onFileSelected(file);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Upload Project ZIP
        </h2>
        <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
          Extract, analyze, detect project root, and upload directly to a new GitHub repository from your browser.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isExtracting && fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition cursor-pointer ${
          isDragOver
            ? 'border-cyan-500 bg-cyan-950/20 ring-4 ring-cyan-500/10'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileChange}
          className="hidden"
        />

        {isExtracting ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-white">Analyzing & Extracting ZIP...</h3>
            <p className="text-xs text-slate-400 mt-1">
              Scanning file structure and detecting project root...
            </p>
            {selectedFile && (
              <div className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300">
                {selectedFile.name} ({formatBytes(selectedFile.size)})
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-cyan-400 flex items-center justify-center mb-4 border border-slate-700 shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-semibold text-white mb-1">
              Drag & Drop your project ZIP file here
            </h3>
            <p className="text-xs text-slate-400 mb-6 max-w-md">
              Supports standard web, React, Node.js, Python, Go, Rust, or any folder archive (.zip).
            </p>

            <button
              type="button"
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-medium text-sm transition shadow-lg shadow-cyan-950/40 flex items-center gap-2"
            >
              <FileArchive className="w-4 h-4" />
              <span>Select ZIP File</span>
            </button>
          </div>
        )}
      </div>

      {/* Selected File Details Banner */}
      {selectedFile && !isExtracting && !extractionError && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{selectedFile.name}</div>
              <div className="text-xs text-slate-400">
                Size: {formatBytes(selectedFile.size)} • Status: Ready to analyze
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extraction Error Box */}
      {extractionError && (
        <div className="mt-6 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">ZIP Extraction Failed</span>
            <span>{extractionError}</span>
          </div>
        </div>
      )}

      {/* Privacy & Security Guarantees */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-slate-200">100% Client-Side</span>
          <span className="text-slate-400">
            Files are unzipped in memory directly inside your web browser. No server uploads.
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-slate-200">Zip Slip Protected</span>
          <span className="text-slate-400">
            Protects against malicious path traversal (`../`) and normalizes directory structures securely.
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-slate-200">Root Detection</span>
          <span className="text-slate-400">
            Automatically locates project root markers like `package.json`, `src/`, or `vite.config.ts`.
          </span>
        </div>
      </div>
    </div>
  );
};
