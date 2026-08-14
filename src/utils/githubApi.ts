import {
  DiffReport,
  ExtractedFileItem,
  FileDiffItem,
  GitHubBranch,
  GitHubRepository,
  GitHubUser,
  RepoConfig,
  UpdateConfig,
  UploadProgress,
  VerificationResult,
} from '../types';
import { calculateGitBlobSha } from './gitHash';
import { arrayBufferToBase64 } from './pathUtils';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Sanitizes and cleans a GitHub token by stripping quotes, whitespace, and prefixes.
 */
export function cleanGitHubToken(token: string): string {
  if (!token) return '';
  let clean = token.trim();
  clean = clean.replace(/^["'`]|["'`]$/g, '').trim();
  clean = clean.replace(/^(bearer|token)\s+/i, '').trim();
  return clean;
}

/**
 * Generates standard headers for GitHub REST API requests.
 */
export function getGitHubHeaders(token: string, extraHeaders?: Record<string, string>): Record<string, string> {
  const clean = cleanGitHubToken(token);
  return {
    Authorization: `Bearer ${clean}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

/**
 * Parses and formats GitHub API errors into clear, actionable messages.
 */
export async function parseGitHubErrorResponse(res: Response, defaultMessage: string): Promise<string> {
  let errorData: any = {};
  try {
    errorData = await res.json();
  } catch {
    // If not JSON
  }

  const rawMsg = errorData.message || res.statusText || defaultMessage;

  // 401 Unauthorized
  if (res.status === 401) {
    return 'Invalid or expired GitHub Personal Access Token (401 Unauthorized). Please generate a new token with "repo" scope.';
  }

  // 403 Forbidden
  if (res.status === 403) {
    if (rawMsg.toLowerCase().includes('rate limit')) {
      return 'GitHub API rate limit exceeded. Please wait a moment or use an authenticated Personal Access Token.';
    }
    if (rawMsg.toLowerCase().includes('secondary rate limit')) {
      return 'GitHub secondary rate limit reached due to rapid requests. The app will automatically retry with backoff.';
    }
    if (rawMsg.toLowerCase().includes('resource not accessible') || rawMsg.toLowerCase().includes('permissions')) {
      return "Access denied (403 Forbidden). Your token lacks the required permissions:\n• For Classic Token (ghp_...): Ensure 'repo' scope is enabled.\n• For Fine-Grained Token (github_pat_...): Ensure 'Repository access' is set to 'All repositories' and 'Permissions -> Contents' is set to 'Read and write'.";
    }
    return `Access denied (403 Forbidden): ${rawMsg}. Please verify token permissions and repository access.`;
  }

  // 404 Not Found
  if (res.status === 404) {
    return `Resource not found on GitHub (404). Note: Private repositories and new Git endpoints return 404 if your token lacks the 'repo' scope, or if the repository is still provisioning.`;
  }

  // 422 Unprocessable Entity
  if (res.status === 422) {
    if (rawMsg.toLowerCase().includes('name already exists')) {
      return 'A repository with this name already exists in your GitHub account. Please choose a different name or use the "Update Existing Repository" mode.';
    }
    if (rawMsg.toLowerCase().includes('reference already exists')) {
      return 'Branch reference already exists on GitHub.';
    }
    return `GitHub validation error (422): ${rawMsg}`;
  }

  return `${defaultMessage}: ${rawMsg} (HTTP ${res.status})`;
}

/**
 * Validates a GitHub Personal Access Token and retrieves authenticated user details and scopes.
 */
export async function validateGitHubToken(token: string): Promise<GitHubUser> {
  const clean = cleanGitHubToken(token);
  if (!clean) {
    throw new Error('Please enter a valid GitHub Personal Access Token.');
  }

  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: getGitHubHeaders(clean),
  });

  if (!res.ok) {
    const errorMsg = await parseGitHubErrorResponse(res, 'Token validation failed');
    throw new Error(errorMsg);
  }

  const data = await res.json();

  // Extract scopes and rate limit headers
  const rawScopes = res.headers.get('x-oauth-scopes');
  const scopes = rawScopes ? rawScopes.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const rateLimitRemaining = res.headers.get('x-ratelimit-remaining')
    ? parseInt(res.headers.get('x-ratelimit-remaining')!, 10)
    : undefined;
  const rateLimitResetTimestamp = res.headers.get('x-ratelimit-reset')
    ? parseInt(res.headers.get('x-ratelimit-reset')!, 10) * 1000
    : undefined;

  let tokenType: 'classic' | 'fine-grained' | 'oauth' | 'unknown' = 'unknown';
  if (clean.startsWith('ghp_')) {
    tokenType = 'classic';
  } else if (clean.startsWith('github_pat_')) {
    tokenType = 'fine-grained';
  } else if (clean.startsWith('gho_')) {
    tokenType = 'oauth';
  } else if (rawScopes !== null) {
    tokenType = 'classic';
  }

  const hasRepoScope = scopes.includes('repo') || scopes.includes('public_repo');

  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
    publicRepos: data.public_repos || 0,
    scopes,
    hasRepoScope,
    tokenType,
    rateLimitRemaining,
    rateLimitReset: rateLimitResetTimestamp ? new Date(rateLimitResetTimestamp) : undefined,
  };
}

/**
 * Checks if a repository with the given name already exists under the user's account.
 */
export async function checkRepositoryExists(token: string, owner: string, repoName: string): Promise<boolean> {
  const clean = cleanGitHubToken(token);
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repoName)}`, {
    headers: getGitHubHeaders(clean),
  });

  if (res.status === 200) {
    return true;
  }
  if (res.status === 404) {
    return false;
  }

  // If rate limit or other error, do not assume false silently
  if (res.status === 401 || res.status === 403) {
    const msg = await parseGitHubErrorResponse(res, 'Failed to check repository');
    throw new Error(msg);
  }

  return false;
}

/**
 * Creates a brand new GitHub repository for the authenticated user.
 */
export async function createGitHubRepository(
  token: string,
  config: RepoConfig
): Promise<{ owner: string; name: string; htmlUrl: string }> {
  const clean = cleanGitHubToken(token);

  const res = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: 'POST',
    headers: getGitHubHeaders(clean),
    body: JSON.stringify({
      name: config.name.trim(),
      description: config.description.trim(),
      private: config.isPrivate,
      auto_init: false, // Create clean empty repository
    }),
  });

  if (!res.ok) {
    const errorMsg = await parseGitHubErrorResponse(res, 'Failed to create repository');
    throw new Error(errorMsg);
  }

  const data = await res.json();
  const owner = data.owner.login;
  const name = data.name;
  const htmlUrl = data.html_url;

  // Give GitHub git storage backend a short moment to initialize the empty repository
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    owner,
    name,
    htmlUrl,
  };
}

/**
 * Uploads project files using the GitHub Git Data API (Blobs -> Tree -> Commit -> Ref).
 * Includes concurrent blob creation, exponential backoff, progress tracking, and fallback ref handling.
 */
export async function uploadProjectToGitHub(
  token: string,
  owner: string,
  repo: string,
  filesToUpload: ExtractedFileItem[],
  onProgress: (progress: UploadProgress) => void
): Promise<{ commitSha: string; progress: UploadProgress }> {
  const clean = cleanGitHubToken(token);
  const total = filesToUpload.length;

  const progress: UploadProgress = {
    totalFiles: total,
    processedFiles: 0,
    currentFile: 'Initializing upload...',
    successfulCount: 0,
    failedCount: 0,
    skippedCount: 0,
    fileResults: filesToUpload.map((f) => ({
      path: f.normalizedPath,
      size: f.size,
      status: 'pending',
    })),
    status: 'in-progress',
  };

  onProgress({ ...progress });

  if (total === 0) {
    progress.status = 'failed';
    progress.errorMessage = 'No files selected for upload.';
    onProgress({ ...progress });
    throw new Error(progress.errorMessage);
  }

  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];

  // Concurrency helper for uploading blobs
  const concurrency = 3;
  let index = 0;

  async function uploadBlobWithRetry(fileItem: ExtractedFileItem, attempt: number = 1): Promise<string> {
    const base64Content = await arrayBufferToBase64(fileItem.content);

    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/blobs`, {
      method: 'POST',
      headers: getGitHubHeaders(clean),
      body: JSON.stringify({
        content: base64Content,
        encoding: 'base64',
      }),
    });

    if (!res.ok) {
      // Retry transient errors (404 for newly created repo replication, 409 for lock/empty init, 403/429 rate limit, 5xx)
      if ((res.status === 404 || res.status === 409 || res.status === 403 || res.status === 429 || res.status >= 500) && attempt <= 5) {
        const delay = Math.min(1000 * Math.pow(1.5, attempt) + Math.random() * 500, 5000);
        await new Promise((r) => setTimeout(r, delay));
        return uploadBlobWithRetry(fileItem, attempt + 1);
      }
      const errorMsg = await parseGitHubErrorResponse(res, `Failed to upload blob for "${fileItem.normalizedPath}"`);
      throw new Error(errorMsg);
    }

    const data = await res.json();
    return data.sha;
  }

  async function worker() {
    while (index < filesToUpload.length) {
      const i = index++;
      const fileItem = filesToUpload[i];

      progress.currentFile = fileItem.normalizedPath;
      progress.fileResults[i].status = 'uploading';
      onProgress({ ...progress });

      try {
        const blobSha = await uploadBlobWithRetry(fileItem);

        progress.fileResults[i].status = 'success';
        progress.fileResults[i].sha = blobSha;
        progress.successfulCount++;

        // Determine git file mode: 100755 for executable scripts, 100644 for regular files
        const isExecutable =
          fileItem.normalizedPath.endsWith('.sh') ||
          fileItem.normalizedPath.endsWith('.bash') ||
          fileItem.normalizedPath.endsWith('.command');
        const mode = isExecutable ? '100755' : '100644';

        treeItems.push({
          path: fileItem.normalizedPath,
          mode,
          type: 'blob',
          sha: blobSha,
        });
      } catch (err: any) {
        progress.fileResults[i].status = 'failed';
        progress.fileResults[i].error = err.message || 'Blob creation failed';
        progress.failedCount++;
      }

      progress.processedFiles++;
      onProgress({ ...progress });

      // Small throttle between files to respect GitHub secondary rate limits
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  // Run workers concurrently
  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  if (progress.successfulCount === 0) {
    progress.status = 'failed';
    const firstError = progress.fileResults.find((f) => f.error)?.error;
    progress.errorMessage =
      firstError ||
      'All file uploads failed. Please check your GitHub token permissions (requires "repo" scope) and network connection.';
    onProgress({ ...progress });
    throw new Error(progress.errorMessage);
  }

  // Step 2: Create Git Tree
  progress.currentFile = 'Creating Git Tree structure...';
  onProgress({ ...progress });

  const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/trees`, {
    method: 'POST',
    headers: getGitHubHeaders(clean),
    body: JSON.stringify({
      tree: treeItems,
    }),
  });

  if (!treeRes.ok) {
    const errorMsg = await parseGitHubErrorResponse(treeRes, 'Git tree creation failed');
    progress.status = 'failed';
    progress.errorMessage = errorMsg;
    onProgress({ ...progress });
    throw new Error(errorMsg);
  }

  const treeData = await treeRes.json();
  const treeSha = treeData.sha;

  // Step 3: Create Initial Commit
  progress.currentFile = 'Creating Initial Commit...';
  onProgress({ ...progress });

  const commitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/commits`, {
    method: 'POST',
    headers: getGitHubHeaders(clean),
    body: JSON.stringify({
      message: 'Initial project upload via ZipToGitHub',
      tree: treeSha,
      parents: [],
    }),
  });

  if (!commitRes.ok) {
    const errorMsg = await parseGitHubErrorResponse(commitRes, 'Git commit creation failed');
    progress.status = 'failed';
    progress.errorMessage = errorMsg;
    onProgress({ ...progress });
    throw new Error(errorMsg);
  }

  const commitData = await commitRes.json();
  const commitSha = commitData.sha;

  // Step 4: Create or Update Ref (main)
  progress.currentFile = 'Updating main branch reference...';
  onProgress({ ...progress });

  let refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/refs`, {
    method: 'POST',
    headers: getGitHubHeaders(clean),
    body: JSON.stringify({
      ref: 'refs/heads/main',
      sha: commitSha,
    }),
  });

  // If ref already exists (HTTP 422), fallback to PATCH
  if (!refRes.ok && refRes.status === 422) {
    refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: getGitHubHeaders(clean),
      body: JSON.stringify({
        sha: commitSha,
        force: true,
      }),
    });
  }

  if (!refRes.ok) {
    const errorMsg = await parseGitHubErrorResponse(refRes, 'Failed to set main branch reference');
    progress.status = 'failed';
    progress.errorMessage = errorMsg;
    onProgress({ ...progress });
    throw new Error(errorMsg);
  }

  // Ensure default branch is set to main
  try {
    await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}`, {
      method: 'PATCH',
      headers: getGitHubHeaders(clean),
      body: JSON.stringify({
        default_branch: 'main',
      }),
    });
  } catch {
    // Non-blocking
  }

  progress.status = progress.failedCount > 0 ? 'paused' : 'completed';
  progress.currentFile = 'Upload complete';
  onProgress({ ...progress });

  return { commitSha, progress };
}

/**
 * Verifies the uploaded GitHub repository tree against the expected file list.
 */
export async function verifyGitHubRepositoryTree(
  token: string,
  owner: string,
  repo: string,
  expectedPaths: string[],
  branch: string = 'main'
): Promise<VerificationResult> {
  const clean = cleanGitHubToken(token);

  // Fetch recursive tree from branch
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    {
      headers: getGitHubHeaders(clean),
    }
  );

  if (!res.ok) {
    const errorMsg = await parseGitHubErrorResponse(res, 'Failed to fetch GitHub repository tree');
    return {
      verified: false,
      expectedCount: expectedPaths.length,
      actualCount: 0,
      missingFiles: expectedPaths,
      unexpectedFiles: [],
      message: errorMsg,
    };
  }

  const data = await res.json();
  const actualItems: { path: string; type: string }[] = data.tree || [];
  const actualBlobs = actualItems.filter((i) => i.type === 'blob').map((i) => i.path);

  const actualSet = new Set(actualBlobs);
  const expectedSet = new Set(expectedPaths);

  const missingFiles: string[] = [];
  for (const exp of expectedPaths) {
    if (!actualSet.has(exp)) {
      missingFiles.push(exp);
    }
  }

  const unexpectedFiles: string[] = [];
  for (const act of actualBlobs) {
    if (!expectedSet.has(act)) {
      unexpectedFiles.push(act);
    }
  }

  const isVerified = missingFiles.length === 0;

  return {
    verified: isVerified,
    expectedCount: expectedPaths.length,
    actualCount: actualBlobs.length,
    missingFiles,
    unexpectedFiles,
    message: isVerified
      ? `Verification Passed: All ${expectedPaths.length} files confirmed in repository tree.`
      : `Verification Warning: ${missingFiles.length} file(s) missing from remote repository tree.`,
  };
}

export interface RemoteTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
}

/**
 * Fetches the user's GitHub repositories with pagination support.
 */
export async function getUserRepositories(token: string): Promise<GitHubRepository[]> {
  const clean = cleanGitHubToken(token);
  const res = await fetch(
    `${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator`,
    {
      headers: getGitHubHeaders(clean),
    }
  );

  if (!res.ok) {
    const errorMsg = await parseGitHubErrorResponse(res, 'Failed to fetch user repositories');
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: {
      login: r.owner.login,
      avatarUrl: r.owner.avatar_url,
    },
    isPrivate: r.private,
    defaultBranch: r.default_branch || 'main',
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
    description: r.description,
  }));
}

/**
 * Fetches branches for a repository.
 */
export async function getRepositoryBranches(token: string, owner: string, repo: string): Promise<GitHubBranch[]> {
  const clean = cleanGitHubToken(token);
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/branches?per_page=100`, {
    headers: getGitHubHeaders(clean),
  });

  if (!res.ok) {
    const errorMsg = await parseGitHubErrorResponse(res, `Failed to fetch branches for ${owner}/${repo}`);
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return data.map((b: any) => ({
    name: b.name,
    commitSha: b.commit.sha,
  }));
}

/**
 * Retrieves latest commit SHA and root tree SHA for a branch.
 */
export async function getLatestCommitAndTree(token: string, owner: string, repo: string, branch: string) {
  const clean = cleanGitHubToken(token);
  const refRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
    {
      headers: getGitHubHeaders(clean),
    }
  );

  if (!refRes.ok) {
    const errorMsg = await parseGitHubErrorResponse(refRes, `Failed to fetch branch reference for "${branch}"`);
    throw new Error(errorMsg);
  }

  const refData = await refRes.json();
  const commitSha = refData.object.sha;

  const commitRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/commits/${commitSha}`,
    {
      headers: getGitHubHeaders(clean),
    }
  );

  if (!commitRes.ok) {
    const errorMsg = await parseGitHubErrorResponse(commitRes, 'Failed to fetch commit details');
    throw new Error(errorMsg);
  }

  const commitData = await commitRes.json();
  return {
    commitSha,
    treeSha: commitData.tree.sha,
  };
}

/**
 * Fetches the complete recursive tree for a given tree SHA.
 */
export async function getGitHubTree(token: string, owner: string, repo: string, treeSha: string): Promise<RemoteTreeItem[]> {
  const clean = cleanGitHubToken(token);
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/trees/${treeSha}?recursive=1`,
    {
      headers: getGitHubHeaders(clean),
    }
  );

  if (!res.ok) {
    const errorMsg = await parseGitHubErrorResponse(res, 'Failed to fetch repository tree');
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return data.tree || [];
}

/**
 * Compares local active files against remote GitHub repository tree.
 */
export async function compareLocalAndRemoteTrees(
  localFiles: ExtractedFileItem[],
  remoteItems: RemoteTreeItem[],
  baseCommitSha: string,
  baseTreeSha: string
): Promise<DiffReport> {
  const activeLocalFiles = localFiles.filter((f) => !f.isExcluded);

  // Calculate local Git Blob SHAs
  const localWithShas = await Promise.all(
    activeLocalFiles.map(async (file) => {
      const sha = file.gitBlobSha || (await calculateGitBlobSha(file.content));
      return { ...file, gitBlobSha: sha };
    })
  );

  const remoteBlobs = remoteItems.filter((i) => i.type === 'blob');

  const remoteMap = new Map<string, RemoteTreeItem>();
  remoteBlobs.forEach((item) => remoteMap.set(item.path, item));

  const localMap = new Map<string, ExtractedFileItem>();
  localWithShas.forEach((item) => localMap.set(item.normalizedPath, item));

  // Map unassigned remote items by SHA to detect renames reliably
  const unassignedRemoteBySha = new Map<string, RemoteTreeItem[]>();
  remoteBlobs.forEach((item) => {
    if (!localMap.has(item.path)) {
      const list = unassignedRemoteBySha.get(item.sha) || [];
      list.push(item);
      unassignedRemoteBySha.set(item.sha, list);
    }
  });

  const newFiles: FileDiffItem[] = [];
  const modifiedFiles: FileDiffItem[] = [];
  const unchangedFiles: FileDiffItem[] = [];
  const renamedFiles: FileDiffItem[] = [];
  const renamedRemotePaths = new Set<string>();

  for (const localFile of localWithShas) {
    const path = localFile.normalizedPath;
    const remoteItem = remoteMap.get(path);

    if (!remoteItem) {
      const matchingRemotes = unassignedRemoteBySha.get(localFile.gitBlobSha!) || [];
      const renameMatch = matchingRemotes.find((r) => !renamedRemotePaths.has(r.path));

      if (renameMatch) {
        renamedRemotePaths.add(renameMatch.path);
        renamedFiles.push({
          path,
          oldPath: renameMatch.path,
          type: 'renamed',
          localFile,
          localSha: localFile.gitBlobSha,
          remoteSha: renameMatch.sha,
          size: localFile.size,
        });
      } else {
        newFiles.push({
          path,
          type: 'new',
          localFile,
          localSha: localFile.gitBlobSha,
          size: localFile.size,
        });
      }
    } else {
      if (remoteItem.sha === localFile.gitBlobSha) {
        unchangedFiles.push({
          path,
          type: 'unchanged',
          localFile,
          localSha: localFile.gitBlobSha,
          remoteSha: remoteItem.sha,
          size: localFile.size,
        });
      } else {
        modifiedFiles.push({
          path,
          type: 'modified',
          localFile,
          localSha: localFile.gitBlobSha,
          remoteSha: remoteItem.sha,
          size: localFile.size,
        });
      }
    }
  }

  const deletedFiles: FileDiffItem[] = [];
  for (const remoteBlob of remoteBlobs) {
    if (!localMap.has(remoteBlob.path) && !renamedRemotePaths.has(remoteBlob.path)) {
      deletedFiles.push({
        path: remoteBlob.path,
        type: 'deleted',
        remoteSha: remoteBlob.sha,
        size: remoteBlob.size || 0,
        confirmDelete: false, // Default: keep
      });
    }
  }

  const totalLocal = activeLocalFiles.length;
  const totalRemote = remoteBlobs.length;
  const totalFinal = totalLocal;

  return {
    newFiles,
    modifiedFiles,
    deletedFiles,
    unchangedFiles,
    renamedFiles,
    totalLocalFiles: totalLocal,
    totalRemoteFiles: totalRemote,
    totalFinalFiles: totalFinal,
    baseCommitSha,
    baseTreeSha,
  };
}

/**
 * Updates an existing GitHub repository by uploading ONLY new/modified files,
 * handling deletions, creating a commit, and patching the branch ref.
 */
export async function updateGitHubRepository(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  updateConfig: UpdateConfig,
  onProgress: (progress: UploadProgress) => void
): Promise<{ commitSha: string; progress: UploadProgress }> {
  const clean = cleanGitHubToken(token);
  const diff = updateConfig.diffReport;

  const filesToUploadItems = [
    ...diff.newFiles,
    ...diff.modifiedFiles,
    ...diff.renamedFiles,
  ];

  const totalToUpload = filesToUploadItems.length;
  const unchangedCount = diff.unchangedFiles.length;

  const progress: UploadProgress = {
    totalFiles: totalToUpload,
    processedFiles: 0,
    currentFile: 'Preparing repository update...',
    successfulCount: 0,
    failedCount: 0,
    skippedCount: unchangedCount,
    fileResults: filesToUploadItems.map((item) => ({
      path: item.path,
      size: item.size || 0,
      status: 'pending',
    })),
    status: 'in-progress',
  };

  onProgress({ ...progress });

  const treeItems: { path: string; mode: string; type: string; sha: string | null }[] = [];

  const concurrency = 3;
  let index = 0;

  async function uploadBlobWithRetry(diffItem: FileDiffItem, attempt: number = 1): Promise<string> {
    if (!diffItem.localFile) {
      throw new Error(`Missing content for local file: ${diffItem.path}`);
    }

    const base64Content = await arrayBufferToBase64(diffItem.localFile.content);

    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/blobs`, {
      method: 'POST',
      headers: getGitHubHeaders(clean),
      body: JSON.stringify({
        content: base64Content,
        encoding: 'base64',
      }),
    });

    if (!res.ok) {
      if ((res.status === 404 || res.status === 409 || res.status === 403 || res.status === 429 || res.status >= 500) && attempt <= 5) {
        const delay = Math.min(1000 * Math.pow(1.5, attempt) + Math.random() * 500, 5000);
        await new Promise((r) => setTimeout(r, delay));
        return uploadBlobWithRetry(diffItem, attempt + 1);
      }
      const errorMsg = await parseGitHubErrorResponse(res, `Failed to upload blob for "${diffItem.path}"`);
      throw new Error(errorMsg);
    }

    const data = await res.json();
    return data.sha;
  }

  async function worker() {
    while (index < filesToUploadItems.length) {
      const currentIndex = index++;
      const diffItem = filesToUploadItems[currentIndex];

      progress.currentFile = diffItem.path;
      progress.fileResults[currentIndex].status = 'uploading';
      onProgress({ ...progress });

      try {
        const sha = await uploadBlobWithRetry(diffItem);
        treeItems.push({
          path: diffItem.path,
          mode: '100644',
          type: 'blob',
          sha,
        });

        progress.successfulCount++;
        progress.fileResults[currentIndex].status = 'success';
        progress.fileResults[currentIndex].sha = sha;
      } catch (err: any) {
        console.error(`Error uploading ${diffItem.path}:`, err);
        progress.failedCount++;
        progress.fileResults[currentIndex].status = 'failed';
        progress.fileResults[currentIndex].error = err.message || 'Blob upload failed';
      } finally {
        progress.processedFiles++;
        onProgress({ ...progress });
      }

      await new Promise((r) => setTimeout(r, 25));
    }
  }

  if (filesToUploadItems.length > 0) {
    const workers = Array.from({ length: Math.min(concurrency, filesToUploadItems.length) }, () => worker());
    await Promise.all(workers);
  }

  if (progress.failedCount > 0 && filesToUploadItems.length > 0) {
    progress.status = 'failed';
    progress.errorMessage = `${progress.failedCount} file(s) failed to upload.`;
    onProgress({ ...progress });
    throw new Error(progress.errorMessage);
  }

  // Handle file deletions
  if (updateConfig.strategy === 'sync') {
    for (const deletedPath of updateConfig.deletedFilesToDelete) {
      treeItems.push({
        path: deletedPath,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    }
  }

  // Handle renamed files removal of old paths
  for (const renamedItem of diff.renamedFiles) {
    if (renamedItem.oldPath) {
      treeItems.push({
        path: renamedItem.oldPath,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    }
  }

  // Repository State Protection: Verify branch HEAD has not changed
  progress.currentFile = 'Verifying remote repository state...';
  onProgress({ ...progress });

  const latestState = await getLatestCommitAndTree(clean, owner, repo, branch);
  if (latestState.commitSha !== diff.baseCommitSha) {
    throw new Error(
      `⚠ Repository changed on GitHub during update! Another commit (${latestState.commitSha.substring(
        0,
        7
      )}) was pushed to branch "${branch}". Please re-compare changes before applying.`
    );
  }

  // Create new tree using base_tree
  progress.currentFile = 'Creating updated GitHub tree...';
  onProgress({ ...progress });

  const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/trees`, {
    method: 'POST',
    headers: getGitHubHeaders(clean),
    body: JSON.stringify({
      base_tree: diff.baseTreeSha,
      tree: treeItems,
    }),
  });

  if (!treeRes.ok) {
    const errorMsg = await parseGitHubErrorResponse(treeRes, 'Failed to create updated tree');
    throw new Error(errorMsg);
  }

  const newTreeData = await treeRes.json();
  const newTreeSha = newTreeData.sha;

  // Create commit
  progress.currentFile = 'Creating commit...';
  onProgress({ ...progress });

  const commitMsg =
    updateConfig.commitMessage.trim() || `Update project - ${new Date().toISOString().split('T')[0]}`;

  const commitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/commits`, {
    method: 'POST',
    headers: getGitHubHeaders(clean),
    body: JSON.stringify({
      message: commitMsg,
      tree: newTreeSha,
      parents: [diff.baseCommitSha],
    }),
  });

  if (!commitRes.ok) {
    const errorMsg = await parseGitHubErrorResponse(commitRes, 'Failed to create commit');
    throw new Error(errorMsg);
  }

  const commitData = await commitRes.json();
  const commitSha = commitData.sha;

  // Update branch ref
  progress.currentFile = 'Updating branch reference...';
  onProgress({ ...progress });

  const refRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method: 'PATCH',
      headers: getGitHubHeaders(clean),
      body: JSON.stringify({
        sha: commitSha,
        force: false,
      }),
    }
  );

  if (!refRes.ok) {
    const errorMsg = await parseGitHubErrorResponse(refRes, 'Failed to update branch reference');
    throw new Error(errorMsg);
  }

  progress.status = 'completed';
  progress.currentFile = 'Update complete';
  onProgress({ ...progress });

  return { commitSha, progress };
}
