import React, { useState, useEffect } from 'react';
import { GitHubUser, RepoConfig } from '../types';
import { validateGitHubToken, checkRepositoryExists } from '../utils/githubApi';
import { Key, Eye, EyeOff, Github, AlertCircle, CheckCircle2, Loader2, Lock, Globe, ArrowRight } from 'lucide-react';

interface GitHubConfigStepProps {
  initialRepoName: string;
  filesToUploadCount: number;
  token: string;
  onTokenChange: (token: string) => void;
  user: GitHubUser | null;
  onUserValidated: (user: GitHubUser) => void;
  onStartUpload: (config: RepoConfig) => void;
  onBackToFileReview: () => void;
}

export const GitHubConfigStep: React.FC<GitHubConfigStepProps> = ({
  initialRepoName,
  filesToUploadCount,
  token,
  onTokenChange,
  user,
  onUserValidated,
  onStartUpload,
  onBackToFileReview,
}) => {
  const [showToken, setShowToken] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Repo settings
  const [repoName, setRepoName] = useState(
    initialRepoName.toLowerCase().replace(/[^a-z0-9._-]/g, '-') || 'my-project'
  );
  const [repoDescription, setRepoDescription] = useState('Project uploaded via ZipToGitHub');
  const [isPrivate, setIsPrivate] = useState(true);

  // Repo Existence Check
  const [isCheckingRepoExists, setIsCheckingRepoExists] = useState(false);
  const [repoExistsError, setRepoExistsError] = useState<string | null>(null);

  const handleValidateToken = async () => {
    if (!token.trim()) {
      setTokenError('Please enter a GitHub Personal Access Token.');
      return;
    }

    setIsValidatingToken(true);
    setTokenError(null);

    try {
      const authenticatedUser = await validateGitHubToken(token);
      onUserValidated(authenticatedUser);
    } catch (err: any) {
      setTokenError(err.message || 'Token validation failed.');
    } finally {
      setIsValidatingToken(false);
    }
  };

  // Check repo existence when user and repoName are present
  useEffect(() => {
    if (!user || !token || !repoName.trim()) return;

    const timer = setTimeout(async () => {
      setIsCheckingRepoExists(true);
      setRepoExistsError(null);

      try {
        const exists = await checkRepositoryExists(token, user.login, repoName.trim());
        if (exists) {
          setRepoExistsError(`Repository "${user.login}/${repoName.trim()}" already exists on GitHub.`);
        }
      } catch {
        // Ignore network errors on passive check
      } finally {
        setIsCheckingRepoExists(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [user, token, repoName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setTokenError('Please validate your GitHub token first.');
      return;
    }
    if (repoExistsError) {
      return;
    }
    if (!repoName.trim()) {
      setRepoExistsError('Please enter a repository name.');
      return;
    }

    onStartUpload({
      name: repoName.trim(),
      description: repoDescription.trim(),
      isPrivate,
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-white flex items-center justify-center gap-2">
          <Github className="w-7 h-7 text-cyan-400" />
          GitHub Repository Setup
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Authenticate with your Personal Access Token and configure your target repository.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Input Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              GitHub Personal Access Token (PAT)
            </label>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=ZipToGitHub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
            >
              Generate new token (needs 'repo' scope) ↗
            </a>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            The token is used strictly in memory for this session to create the repository and upload your files. Never stored or logged.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => {
                  onTokenChange(e.target.value);
                  setTokenError(null);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleValidateToken}
              disabled={isValidatingToken || !token.trim()}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold text-xs transition flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {isValidatingToken ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Validate Token</span>
                </>
              )}
            </button>
          </div>

          {/* Token Error Message */}
          {tokenError && (
            <div className="mt-3 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{tokenError}</span>
            </div>
          )}

          {/* User Account Card */}
          {user && (
            <div className="mt-4 p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={user.avatarUrl}
                  alt={user.login}
                  className="w-9 h-9 rounded-full border border-cyan-700"
                />
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    {user.name || user.login}
                    <span className="text-xs font-mono font-normal text-cyan-400">@{user.login}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Authenticated GitHub User</div>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Token Active
              </span>
            </div>
          )}
        </div>

        {/* Repo Settings Card (Shown when user authenticated) */}
        {user && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Target Repository Settings
            </h3>

            {/* Repo Name Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Repository Name
              </label>
              <div className="relative">
                <div className="flex rounded-xl bg-slate-950 border border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500">
                  <span className="px-3 py-2.5 text-xs text-slate-400 border-r border-slate-800 bg-slate-900 font-mono select-none flex items-center">
                    github.com/{user.login}/
                  </span>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => {
                      setRepoName(e.target.value);
                      setRepoExistsError(null);
                    }}
                    placeholder="my-new-project"
                    required
                    className="w-full bg-transparent px-3 py-2.5 text-sm font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              {isCheckingRepoExists && (
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                  Checking repository name availability...
                </div>
              )}

              {repoExistsError && (
                <div className="mt-2 p-2.5 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-xs flex items-center gap-2 font-mono">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{repoExistsError}</span>
                </div>
              )}
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={repoDescription}
                onChange={(e) => setRepoDescription(e.target.value)}
                placeholder="Brief project summary..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Visibility Options */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Repository Visibility
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    isPrivate
                      ? 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/20 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Lock className={`w-5 h-5 ${isPrivate ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-bold">Private</div>
                    <div className="text-[10px] text-slate-400">Only you can see this repo</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    !isPrivate
                      ? 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/20 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Globe className={`w-5 h-5 ${!isPrivate ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-bold">Public</div>
                    <div className="text-[10px] text-slate-400">Anyone on internet can see this repo</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={onBackToFileReview}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            ← Back to File Review
          </button>

          <button
            type="submit"
            disabled={!user || !!repoExistsError || !repoName.trim() || isCheckingRepoExists}
            className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold text-sm transition shadow-lg shadow-cyan-950/40 flex items-center gap-2 disabled:opacity-50"
          >
            <span>Create Repo & Upload ({filesToUploadCount} Files)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
