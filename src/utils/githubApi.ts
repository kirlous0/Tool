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
 * Validates a GitHub Personal Access Token and retrieves authenticated user details.
 */
export async function validateGitHubToken(token: string): Promise<GitHubUser> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('Please enter a valid GitHub Personal Access Token.');
  }

  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (res.status === 401) {
    throw new Error('Invalid GitHub token. Authentication failed (401 Unauthorized).');
  }

  if (res.status === 403) {
    throw new Error('GitHub token access denied (403 Forbidden). Token may lack required scopes or be rate limited.');
  }

  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();
  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
    publicRepos: data.public_repos || 0,
  };
}

/**
 * Checks if a repository with the given name already exists under the user's account.
 */
export async function checkRepositoryExists(token: string, owner: string, repoName: string): Promise<boolean> {
  const cleanToken = token.trim();
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repoName)}`, {
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (res.status === 200) {
    return true; // Repository exists
  }
  if (res.status === 404) {
    return false; // Repository does not exist
  }

  // Handle other unexpected errors
  throw new Error(`Failed to check repository existence: HTTP ${res.status}`);
}

/**
 * Creates a brand new GitHub repository for the authenticated user.
 */
export async function createGitHubRepository(
  token: string,
  config: RepoConfig
): Promise<{ owner: string; name: string; htmlUrl: string }> {
  const cleanToken = token.trim();

  const res = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: 'POST',
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: config.name.trim(),
      description: config.description.trim(),
      private: config.isPrivate,
      auto_init: false, // Create clean empty repository
    }),
  });

  if (res.status === 422) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Repository creation failed: Name "${config.name}" already exists or is invalid on GitHub.`);
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const msg = errorData.message || res.statusText;
    throw new Error(`Failed to create repository: ${msg} (HTTP ${res.status})`);
  }

  const data = await res.json();
  return {
    owner: data.owner.login,
    name: data.name,
    htmlUrl: data.html_url,
  };
}

/**
 * Uploads project files using the GitHub Git Data API (Blobs -> Tree -> Commit -> Ref).
 * Includes concurrent blob creation, progress tracking, and error details.
 */
export async function uploadProjectToGitHub(
  token: string,
  owner: string,
  repo: string,
  filesToUpload: ExtractedFileItem[],
  onProgress: (progress: UploadProgress) => void
): Promise<{ commitSha: string; progress: UploadProgress }> {
  const cleanToken = token.trim();
  const total = filesToUpload.length;

  const progress: UploadProgress = {
    totalFiles: total,
    processedFiles: 0,
    currentFile: '',
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

  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];

  // Concurrency helper for uploading blobs
  const concurrency = 4;
  let index = 0;

  async function uploadBlobWithRetry(fileItem: ExtractedFileItem, attempt: number = 1): Promise<string> {
    const base64Content = arrayBufferToBase64(fileItem.content);

    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: {
        Authorization: `token ${cleanToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: base64Content,
        encoding: 'base64',
      }),
    });

    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        // Exponential backoff retry
        await new Promise((r) => setTimeout(r, attempt * 1000));
        return uploadBlobWithRetry(fileItem, attempt + 1);
      }
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `HTTP ${res.status}: ${res.statusText}`);
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
        const isExecutable = fileItem.normalizedPath.endsWith('.sh') || fileItem.normalizedPath.endsWith('.bash');
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
    }
  }

  // Run workers concurrently
  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  if (progress.successfulCount === 0) {
    progress.status = 'failed';
    progress.errorMessage = 'All file blob creations failed. Check your network or GitHub token permissions.';
    onProgress({ ...progress });
    throw new Error(progress.errorMessage);
  }

  // Step 2: Create Tree
  progress.currentFile = 'Creating Git Tree structure...';
  onProgress({ ...progress });

  const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tree: treeItems,
    }),
  });

  if (!treeRes.ok) {
    const errData = await treeRes.json().catch(() => ({}));
    progress.status = 'failed';
    progress.errorMessage = `Git tree creation failed: ${errData.message || treeRes.statusText}`;
    onProgress({ ...progress });
    throw new Error(progress.errorMessage);
  }

  const treeData = await treeRes.json();
  const treeSha = treeData.sha;

  // Step 3: Create Commit
  progress.currentFile = 'Creating Initial Commit...';
  onProgress({ ...progress });

  const commitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Initial project upload',
      tree: treeSha,
      parents: [],
    }),
  });

  if (!commitRes.ok) {
    const errData = await commitRes.json().catch(() => ({}));
    progress.status = 'failed';
    progress.errorMessage = `Git commit creation failed: ${errData.message || commitRes.statusText}`;
    onProgress({ ...progress });
    throw new Error(progress.errorMessage);
  }

  const commitData = await commitRes.json();
  const commitSha = commitData.sha;

  // Step 4: Create Ref (main)
  progress.currentFile = 'Updating main branch reference...';
  onProgress({ ...progress });

  const refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'refs/heads/main',
      sha: commitSha,
    }),
  });

  if (!refRes.ok) {
    const errData = await refRes.json().catch(() => ({}));
    progress.status = 'failed';
    progress.errorMessage = `Failed to create branch ref: ${errData.message || refRes.statusText}`;
    onProgress({ ...progress });
    throw new Error(progress.errorMessage);
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
  expectedPaths: string[]
): Promise<VerificationResult> {
  const cleanToken = token.trim();

  // Fetch recursive tree from main branch
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    return {
      verified: false,
      expectedCount: expectedPaths.length,
      actualCount: 0,
      missingFiles: expectedPaths,
      unexpectedFiles: [],
      message: `Failed to fetch GitHub repository tree: HTTP ${res.status}`,
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
      : `Verification Failed: ${missingFiles.length} file(s) missing from remote repository tree.`,
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
 * Fetches the user's GitHub repositories.
 */
export async function getUserRepositories(token: string): Promise<GitHubRepository[]> {
  const cleanToken = token.trim();
  const res = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator`, {
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Failed to fetch user repositories: ${errData.message || res.statusText} (HTTP ${res.status})`);
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
  const cleanToken = token.trim();
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/branches?per_page=100`, {
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Failed to fetch branches for ${owner}/${repo}: ${errData.message || res.statusText}`);
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
  const cleanToken = token.trim();
  const refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!refRes.ok) {
    const errData = await refRes.json().catch(() => ({}));
    throw new Error(`Failed to fetch branch reference for "${branch}": ${errData.message || refRes.statusText}`);
  }

  const refData = await refRes.json();
  const commitSha = refData.object.sha;

  const commitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/commits/${commitSha}`, {
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!commitRes.ok) {
    const errData = await commitRes.json().catch(() => ({}));
    throw new Error(`Failed to fetch commit details: ${errData.message || commitRes.statusText}`);
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
  const cleanToken = token.trim();
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/trees/${treeSha}?recursive=1`, {
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Failed to fetch repository tree: ${errData.message || res.statusText}`);
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
  const cleanToken = token.trim();
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

  const concurrency = 4;
  let index = 0;

  async function uploadBlobWithRetry(diffItem: FileDiffItem, attempt: number = 1): Promise<string> {
    if (!diffItem.localFile) {
      throw new Error(`Missing content for local file: ${diffItem.path}`);
    }

    const base64Content = arrayBufferToBase64(diffItem.localFile.content);

    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/blobs`, {
      method: 'POST',
      headers: {
        Authorization: `token ${cleanToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: base64Content,
        encoding: 'base64',
      }),
    });

    if (res.status === 403 || res.status === 429) {
      if (attempt <= 3) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        return uploadBlobWithRetry(diffItem, attempt + 1);
      }
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Failed to upload blob for ${diffItem.path}: ${errData.message || res.statusText}`);
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

  const latestState = await getLatestCommitAndTree(cleanToken, owner, repo, branch);
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
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base_tree: diff.baseTreeSha,
      tree: treeItems,
    }),
  });

  if (!treeRes.ok) {
    const errData = await treeRes.json().catch(() => ({}));
    throw new Error(`Failed to create updated tree: ${errData.message || treeRes.statusText}`);
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
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: commitMsg,
      tree: newTreeSha,
      parents: [diff.baseCommitSha],
    }),
  });

  if (!commitRes.ok) {
    const errData = await commitRes.json().catch(() => ({}));
    throw new Error(`Failed to create commit: ${errData.message || commitRes.statusText}`);
  }

  const commitData = await commitRes.json();
  const commitSha = commitData.sha;

  // Update branch ref
  progress.currentFile = 'Updating branch reference...';
  onProgress({ ...progress });

  const refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sha: commitSha,
      force: false,
    }),
  });

  if (!refRes.ok) {
    const errData = await refRes.json().catch(() => ({}));
    throw new Error(`Failed to update branch reference: ${errData.message || refRes.statusText}`);
  }

  progress.status = 'completed';
  progress.currentFile = 'Update complete';
  onProgress({ ...progress });

  return { commitSha, progress };
}

