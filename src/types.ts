export type AppMode = 'create' | 'update';

export type AppStep =
  | 'mode-selection'
  | 'upload'
  | 'root-detection'
  | 'file-review'
  | 'github-config'
  | 'repo-selection'
  | 'diff-review'
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
  gitBlobSha?: string; // Precomputed Git Blob SHA-1
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
  scopes?: string[];
  hasRepoScope?: boolean;
  tokenType?: 'classic' | 'fine-grained' | 'oauth' | 'unknown';
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

export interface RepoConfig {
  name: string;
  description: string;
  isPrivate: boolean;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
  isPrivate: boolean;
  defaultBranch: string;
  updatedAt: string;
  htmlUrl: string;
  description: string | null;
}

export interface GitHubBranch {
  name: string;
  commitSha: string;
}

export type DiffType = 'new' | 'modified' | 'deleted' | 'unchanged' | 'renamed';

export interface FileDiffItem {
  path: string;
  type: DiffType;
  oldPath?: string; // For renamed files
  localFile?: ExtractedFileItem;
  remoteSha?: string;
  localSha?: string;
  size?: number;
  confirmDelete?: boolean; // User confirmation for deleted files
}

export interface DiffReport {
  newFiles: FileDiffItem[];
  modifiedFiles: FileDiffItem[];
  deletedFiles: FileDiffItem[];
  unchangedFiles: FileDiffItem[];
  renamedFiles: FileDiffItem[];
  totalLocalFiles: number;
  totalRemoteFiles: number;
  totalFinalFiles: number;
  baseCommitSha: string;
  baseTreeSha: string;
}

export type UpdateStrategy = 'modified-only' | 'sync';

export interface UpdateConfig {
  selectedRepo: GitHubRepository;
  selectedBranch: string;
  strategy: UpdateStrategy;
  commitMessage: string;
  deletedFilesToDelete: Set<string>; // set of paths user confirmed to delete
  diffReport: DiffReport;
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

