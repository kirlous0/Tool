export type AppStep =
  | 'upload'
  | 'root-detection'
  | 'file-review'
  | 'github-config'
  | 'uploading'
  | 'completed';

export type FileStatus = 'ready' | 'warning' | 'sensitive' | 'error';

export interface SensitiveMatch {
  type: string;
  pattern: string;
  maskedSnippet?: string;
}

export interface ExtractedFileItem {
  id: string;
  originalPath: string; // Exact path in the ZIP
  normalizedPath: string; // Path relative to selected root
  fileName: string;
  extension: string;
  size: number; // in bytes
  isDir: boolean;
  content: ArrayBuffer;
  status: FileStatus;
  statusMessage?: string;
  sensitiveMatches?: SensitiveMatch[];
  isRecommendedExclude?: boolean; // node_modules, .next, dist, etc.
  isExcluded: boolean; // whether user chose to skip uploading this file
  isBinary: boolean;
}

export interface CandidateRoot {
  path: string; // e.g. "my-project" or ""
  name: string; // e.g. "my-project" or "ZIP Root"
  depth: number;
  indicatorScore: number;
  indicatorsFound: string[];
  fileCount: number;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  publicRepos: number;
}

export interface RepoConfig {
  name: string;
  description: string;
  isPrivate: boolean;
}

export interface UploadFileResult {
  path: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  sha?: string;
  error?: string;
}

export interface UploadProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  successfulCount: number;
  failedCount: number;
  skippedCount: number;
  fileResults: UploadFileResult[];
  status: 'idle' | 'in-progress' | 'completed' | 'failed' | 'paused';
  errorMessage?: string;
}

export interface VerificationResult {
  verified: boolean;
  expectedCount: number;
  actualCount: number;
  missingFiles: string[];
  unexpectedFiles: string[];
  message: string;
}
