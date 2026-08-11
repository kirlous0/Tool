import React, { useState, useEffect } from 'react';
import {
  Key,
  FolderGit2,
  GitBranch,
  Search,
  Lock,
  Globe,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  User,
  ExternalLink,
} from 'lucide-react';
import { GitHubBranch, GitHubRepository, GitHubUser } from '../types';
import {
  getUserRepositories,
  getRepositoryBranches,
  getLatestCommitAndTree,
  getGitHubTree,
  compareLocalAndRemoteTrees,
  validateGitHubToken,
} from '../utils/githubApi';
import { ExtractedFileItem, DiffReport } from '../types';

interface RepoSelectionStepProps {
  token: string;
  user: GitHubUser | null;
  extractedFiles: ExtractedFileItem[];
  onTokenValidated: (token: string, user: GitHubUser) => void;
  onDiffGenerated: (
    selectedRepo: GitHubRepository,
    selectedBranch: string,
    diffReport: DiffReport
  ) => void;
  onBack: () => void;
}

export const RepoSelectionStep: React.FC<RepoSelectionStepProps> = ({
  token,
  user,
  extractedFiles,
  onTokenValidated,
  onDiffGenerated,
  onBack,
}) => {
  const [inputToken, setInputToken] = useState(token);
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(user);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Validate token if already present or user connects
  const handleConnectToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = inputToken.trim();
    if (!cleanToken) {
      setTokenError('Please enter a valid Personal Access Token.');
      return;
    }

    setIsValidatingToken(true);
    setTokenError(null);

    try {
      const validatedUser = await validateGitHubToken(cleanToken);
      setCurrentUser(validatedUser);
      onTokenValidated(cleanToken, validatedUser);
      loadUserRepositories(cleanToken);
    } catch (err: any) {
      setTokenError(err.message || 'Token validation failed.');
    } finally {
      setIsValidatingToken(false);
    }
  };

  const loadUserRepositories = async (pat: string) => {
    setIsLoadingRepos(true);
    setRepoError(null);
    try {
      const repos = await getUserRepositories(pat);
      setRepositories(repos);
    } catch (err: any) {
      setRepoError(err.message || 'Failed to load repositories.');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Automatically fetch repos if token is already validated
  useEffect(() => {
    if (token && currentUser) {
      loadUserRepositories(token);
    }
  }, [token, currentUser]);

  // When a repository is selected, fetch its branches
  const handleSelectRepository = async (repo: GitHubRepository) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.defaultBranch || 'main');
    setIsLoadingBranches(true);
    setCompareError(null);

    try {
      const fetchedBranches = await getRepositoryBranches(inputToken, repo.owner.login, repo.name);
      setBranches(fetchedBranches);
      if (!fetchedBranches.some((b) => b.name === repo.defaultBranch) && fetchedBranches.length > 0) {
        setSelectedBranch(fetchedBranches[0].name);
      }
    } catch (err: any) {
      console.warn('Could not load branches:', err);
      // Fallback to default branch if branches endpoint fails
      setBranches([{ name: repo.defaultBranch || 'main', commitSha: '' }]);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleStartComparison = async () => {
    if (!selectedRepo || !selectedBranch) return;

    setIsComparing(true);
    setCompareError(null);

    try {
      // 1. Fetch latest commit SHA and root tree SHA
      const { commitSha, treeSha } = await getLatestCommitAndTree(
        inputToken,
        selectedRepo.owner.login,
        selectedRepo.name,
        selectedBranch
      );

      // 2. Fetch full remote tree
      const remoteItems = await getGitHubTree(
        inputToken,
        selectedRepo.owner.login,
        selectedRepo.name,
        treeSha
      );

      // 3. Compare local vs remote
      const diffReport = await compareLocalAndRemoteTrees(
        extractedFiles,
        remoteItems,
        commitSha,
        treeSha
      );

      onDiffGenerated(selectedRepo, selectedBranch, diffReport);
    } catch (err: any) {
      console.error('Comparison error:', err);
      setCompareError(err.message || 'Failed to compare repository. Ensure the branch exists and is accessible.');
    } finally {
      setIsComparing(false);
    }
  };

  const filteredRepos = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-sky-400" />
            <span>Select Existing Repository</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Choose the GitHub repository and branch you wish to update with your project ZIP.
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

      {/* GitHub Authentication Box if not authenticated */}
      {!currentUser ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">GitHub Authentication</h3>
              <p className="text-xs text-slate-400">Enter a Personal Access Token with repo scope to view your repositories.</p>
            </div>
          </div>

          <form onSubmit={handleConnectToken} className="space-y-3">
            <div className="relative">
              <input
                type="password"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            {tokenError && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{tokenError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isValidatingToken || !inputToken.trim()}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isValidatingToken ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating Token...</span>
                </>
              ) : (
                <>
                  <span>Connect & Fetch Repositories</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Authenticated User Status Header */
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.login}
              className="w-9 h-9 rounded-full border border-slate-700"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">{currentUser.name || currentUser.login}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">@{currentUser.login}</span>
              </div>
              <p className="text-xs text-slate-400">Authenticated via Personal Access Token</p>
            </div>
          </div>

          <button
            onClick={() => loadUserRepositories(token)}
            disabled={isLoadingRepos}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs transition flex items-center gap-1.5 border border-slate-700/50"
            title="Refresh repository list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRepos ? 'animate-spin text-sky-400' : ''}`} />
            <span>Refresh Repos</span>
          </button>
        </div>
      )}

      {/* Repository Selection List */}
      {currentUser && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-sky-400" />
              <span>Your GitHub Repositories</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {repositories.length}
              </span>
            </h3>

            {/* Search Filter */}
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {repoError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{repoError}</span>
              </div>
              <button
                onClick={() => loadUserRepositories(token)}
                className="underline hover:text-rose-300 font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {isLoadingRepos ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-xs">Fetching repositories from GitHub...</span>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              {searchQuery ? 'No repositories found matching your search query.' : 'No repositories found under this account.'}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredRepos.map((repo) => {
                const isSelected = selectedRepo?.id === repo.id;
                return (
                  <div
                    key={repo.id}
                    onClick={() => handleSelectRepository(repo)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/50 shadow-md shadow-sky-950/20'
                        : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
                        <FolderGit2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-200 truncate">{repo.name}</span>
                          {repo.isPrivate ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Private</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Globe className="w-2.5 h-2.5" />
                              <span>Public</span>
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{repo.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-500 font-mono">{repo.defaultBranch}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'bg-sky-500 border-sky-400 text-slate-950' : 'border-slate-700'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Repository & Branch Details */}
      {selectedRepo && (
        <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-sky-400" />
              <span>Target Branch Configuration</span>
            </h3>

            <a
              href={selectedRepo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>{selectedRepo.fullName}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Selected Repository</label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-medium text-slate-200 flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-sky-400" />
                <span>{selectedRepo.fullName}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Branch</label>
              {isLoadingBranches ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span>Loading branches...</span>
                </div>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {compareError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{compareError}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleStartComparison}
              disabled={isComparing || !selectedBranch}
              className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-sky-950/30 flex items-center gap-2 disabled:opacity-50"
            >
              {isComparing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Comparing Repository & ZIP...</span>
                </>
              ) : (
                <>
                  <span>Compare Repository & Proceed</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
