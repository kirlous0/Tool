import { ExtractedFileItem, GitHubUser, RepoConfig, UploadProgress, VerificationResult } from '../types';
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
