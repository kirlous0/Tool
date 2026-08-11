import React, { useState } from 'react';
import {
  AppMode,
  AppStep,
  CandidateRoot,
  DiffReport,
  ExtractedFileItem,
  GitHubRepository,
  GitHubUser,
  RepoConfig,
  UpdateConfig,
  UploadProgress,
  VerificationResult,
} from './types';
import { Header } from './components/Header';
import { ZipUploadStep } from './components/ZipUploadStep';
import { RootDetectionStep } from './components/RootDetectionStep';
import { FileReviewStep } from './components/FileReviewStep';
import { GitHubConfigStep } from './components/GitHubConfigStep';
import { RepoSelectionStep } from './components/RepoSelectionStep';
import { DiffReviewStep } from './components/DiffReviewStep';
import { UploadProgressStep } from './components/UploadProgressStep';
import { FinalResultStep } from './components/FinalResultStep';
import { analyzeZipFile, extractFilesFromRoot, ZipAnalysisResult } from './utils/zipAnalyzer';
import {
  createGitHubRepository,
  uploadProjectToGitHub,
  updateGitHubRepository,
  verifyGitHubRepositoryTree,
} from './utils/githubApi';

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('create');
  const [step, setStep] = useState<AppStep>('upload');

  // ZIP Analysis State
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [zipAnalysis, setZipAnalysis] = useState<ZipAnalysisResult | null>(null);

  // Root Detection State
  const [selectedRootPath, setSelectedRootPath] = useState<string>('');
  const [preserveFolder, setPreserveFolder] = useState<boolean>(false);

  // Extracted Files State
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFileItem[]>([]);

  // GitHub Setup State (Create Mode)
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repoConfig, setRepoConfig] = useState<RepoConfig | null>(null);

  // GitHub Setup State (Update Mode)
  const [updateConfig, setUpdateConfig] = useState<UpdateConfig | null>(null);
  const [commitSha, setCommitSha] = useState<string>('');

  // Upload & Verification State
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [createdRepoUrl, setCreatedRepoUrl] = useState<string>('');

  // Step 1: ZIP File Selected
  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsExtracting(true);
    setExtractionError(null);

    try {
      const result = await analyzeZipFile(selectedFile);
      setZipAnalysis(result);
      setSelectedRootPath(result.detectedRoot.path);
      setStep('root-detection');
    } catch (err: any) {
      setExtractionError(err.message || 'Failed to extract ZIP archive.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Step 2: Confirm Root & Extract Files
  const handleConfirmRoot = async () => {
    if (!zipAnalysis) return;

    setIsExtracting(true);
    try {
      const items = await extractFilesFromRoot(
        zipAnalysis.rawEntries,
        selectedRootPath,
        preserveFolder
      );
      setExtractedFiles(items);
      setStep('file-review');
    } catch (err: any) {
      setExtractionError(err.message || 'Error extracting files under selected root.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Toggle individual file exclusion
  const handleToggleExcludeFile = (id: string) => {
    setExtractedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isExcluded: !f.isExcluded } : f))
    );
  };

  // Toggle all recommended excludes (node_modules, build, etc.)
  const handleToggleExcludeAllRecommended = (exclude: boolean) => {
    setExtractedFiles((prev) =>
      prev.map((f) => (f.isRecommendedExclude ? { ...f, isExcluded: exclude } : f))
    );
  };

  // Step 3: Confirm Files & Go to next step based on Mode
  const handleConfirmFileReview = () => {
    if (appMode === 'create') {
      setStep('github-config');
    } else {
      setStep('repo-selection');
    }
  };

  // Update Mode Step: Diff generated from Repo Selection
  const handleDiffGenerated = (
    selectedRepo: GitHubRepository,
    selectedBranch: string,
    diffReport: DiffReport
  ) => {
    setUpdateConfig({
      selectedRepo,
      selectedBranch,
      strategy: 'modified-only',
      commitMessage: `Update project - ${new Date().toISOString().split('T')[0]}`,
      deletedFilesToDelete: new Set(),
      diffReport,
    });
    setStep('diff-review');
  };

  // Execute Update Repository Flow (Update Mode)
  const handleStartUpdateProcess = async (config: UpdateConfig) => {
    if (!token) return;

    setUpdateConfig(config);
    setCreatedRepoUrl(config.selectedRepo.htmlUrl);
    setStep('uploading');

    try {
      const updateRes = await updateGitHubRepository(
        token,
        config.selectedRepo.owner.login,
        config.selectedRepo.name,
        config.selectedBranch,
        config,
        (progress) => setUploadProgress({ ...progress })
      );

      setCommitSha(updateRes.commitSha);

      // Verify final tree
      const expectedPaths = [
        ...config.diffReport.unchangedFiles.map((f) => f.path),
        ...config.diffReport.newFiles.map((f) => f.path),
        ...config.diffReport.modifiedFiles.map((f) => f.path),
        ...config.diffReport.renamedFiles.map((f) => f.path),
      ];

      const verifyRes = await verifyGitHubRepositoryTree(
        token,
        config.selectedRepo.owner.login,
        config.selectedRepo.name,
        expectedPaths
      );

      setVerificationResult(verifyRes);
      setStep('completed');
    } catch (err: any) {
      console.error('Update process failed:', err);
      setUploadProgress((prev) => ({
        totalFiles: config.diffReport.newFiles.length + config.diffReport.modifiedFiles.length,
        processedFiles: prev?.processedFiles || 0,
        currentFile: 'Update failed',
        successfulCount: prev?.successfulCount || 0,
        failedCount: prev?.failedCount || 1,
        skippedCount: config.diffReport.unchangedFiles.length,
        fileResults: prev?.fileResults || [],
        status: 'failed',
        errorMessage: err.message || 'An error occurred during repository update.',
      }));
    }
  };

  // Create Mode Flow: Start Upload Process (Create Mode)
  const handleStartUpload = async (config: RepoConfig) => {
    if (!user || !token) return;

    setRepoConfig(config);
    setStep('uploading');

    const activeFiles = extractedFiles.filter(
      (f) => !f.isExcluded && f.status !== 'error'
    );

    const initialSkippedCount = extractedFiles.filter((f) => f.isExcluded).length;

    setUploadProgress({
      totalFiles: activeFiles.length,
      processedFiles: 0,
      currentFile: 'Creating GitHub repository...',
      successfulCount: 0,
      failedCount: 0,
      skippedCount: initialSkippedCount,
      fileResults: activeFiles.map((f) => ({
        path: f.normalizedPath,
        size: f.size,
        status: 'pending',
      })),
      status: 'in-progress',
    });

    try {
      // 1. Create Repository
      const repo = await createGitHubRepository(token, config);
      setCreatedRepoUrl(repo.htmlUrl);

      // 2. Upload Files via Git Data API
      await uploadProjectToGitHub(
        token,
        repo.owner,
        repo.name,
        activeFiles,
        (progress) => setUploadProgress({ ...progress })
      );

      // 3. Mandatory Verification
      const activePaths = activeFiles.map((f) => f.normalizedPath);
      const verifyRes = await verifyGitHubRepositoryTree(
        token,
        repo.owner,
        repo.name,
        activePaths
      );

      setVerificationResult(verifyRes);
      setStep('completed');
    } catch (err: any) {
      console.error('Upload process failed:', err);
      setUploadProgress((prev) => ({
        totalFiles: activeFiles.length,
        processedFiles: prev?.processedFiles || 0,
        currentFile: 'Upload failed',
        successfulCount: prev?.successfulCount || 0,
        failedCount: prev?.failedCount || activeFiles.length,
        skippedCount: initialSkippedCount,
        fileResults: prev?.fileResults || [],
        status: 'failed',
        errorMessage: err.message || 'An error occurred during repository creation or file upload.',
      }));
    }
  };

  // Retry Failed Files
  const handleRetryFailed = async () => {
    if (appMode === 'create' && repoConfig) {
      handleStartUpload(repoConfig);
    } else if (appMode === 'update' && updateConfig) {
      handleStartUpdateProcess(updateConfig);
    }
  };

  // Full Reset to Upload State
  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setIsExtracting(false);
    setExtractionError(null);
    setZipAnalysis(null);
    setSelectedRootPath('');
    setPreserveFolder(false);
    setExtractedFiles([]);
    setRepoConfig(null);
    setUpdateConfig(null);
    setUploadProgress(null);
    setVerificationResult(null);
    setCreatedRepoUrl('');
    setCommitSha('');
  };

  // Compute default initial repo name
  const getInitialRepoName = () => {
    if (zipAnalysis?.detectedRoot.name && zipAnalysis.detectedRoot.path !== '') {
      return zipAnalysis.detectedRoot.name;
    }
    if (file) {
      return file.name.replace(/\.zip$/i, '');
    }
    return 'my-project';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-sky-500 selection:text-slate-950">
      <Header currentStep={step} onReset={handleReset} />

      <main className="flex-1 pb-16">
        {step === 'upload' && (
          <ZipUploadStep
            appMode={appMode}
            onModeChange={setAppMode}
            onFileSelected={handleFileSelected}
            isExtracting={isExtracting}
            extractionError={extractionError}
          />
        )}

        {step === 'root-detection' && zipAnalysis && (
          <RootDetectionStep
            zipName={zipAnalysis.zipName}
            detectedRoot={zipAnalysis.detectedRoot}
            candidateRoots={zipAnalysis.candidateRoots}
            hasMultipleRoots={zipAnalysis.hasMultipleRoots}
            selectedRootPath={selectedRootPath}
            onSelectRootPath={setSelectedRootPath}
            preserveFolder={preserveFolder}
            onTogglePreserveFolder={setPreserveFolder}
            onConfirm={handleConfirmRoot}
            warningMessage={zipAnalysis.warningMessage}
          />
        )}

        {step === 'file-review' && (
          <FileReviewStep
            files={extractedFiles}
            onToggleExcludeFile={handleToggleExcludeFile}
            onToggleExcludeAllRecommended={handleToggleExcludeAllRecommended}
            onConfirm={handleConfirmFileReview}
            onBackToRoot={() => setStep('root-detection')}
          />
        )}

        {step === 'github-config' && (
          <GitHubConfigStep
            initialRepoName={getInitialRepoName()}
            filesToUploadCount={extractedFiles.filter((f) => !f.isExcluded && f.status !== 'error').length}
            token={token}
            onTokenChange={setToken}
            user={user}
            onUserValidated={setUser}
            onStartUpload={handleStartUpload}
            onBackToFileReview={() => setStep('file-review')}
          />
        )}

        {step === 'repo-selection' && (
          <RepoSelectionStep
            token={token}
            user={user}
            extractedFiles={extractedFiles}
            onTokenValidated={(newToken, newUser) => {
              setToken(newToken);
              setUser(newUser);
            }}
            onDiffGenerated={handleDiffGenerated}
            onBack={() => setStep('file-review')}
          />
        )}

        {step === 'diff-review' && updateConfig && (
          <DiffReviewStep
            selectedRepo={updateConfig.selectedRepo}
            selectedBranch={updateConfig.selectedBranch}
            diffReport={updateConfig.diffReport}
            onConfirmUpdate={handleStartUpdateProcess}
            onBack={() => setStep('repo-selection')}
          />
        )}

        {step === 'uploading' && uploadProgress && (
          <UploadProgressStep
            progress={uploadProgress}
            onRetryFailed={handleRetryFailed}
            onProceedToVerification={() => setStep('completed')}
          />
        )}

        {step === 'completed' && user && (
          <FinalResultStep
            appMode={appMode}
            repoUrl={createdRepoUrl}
            repoConfig={
              repoConfig || {
                name: updateConfig?.selectedRepo.name || '',
                description: updateConfig?.selectedRepo.description || '',
                isPrivate: updateConfig?.selectedRepo.isPrivate || false,
              }
            }
            user={user}
            verification={verificationResult}
            uploadedCount={uploadProgress?.successfulCount || 0}
            skippedCount={extractedFiles.filter((f) => f.isExcluded).length}
            failedCount={uploadProgress?.failedCount || 0}
            updateConfig={updateConfig}
            commitSha={commitSha}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

