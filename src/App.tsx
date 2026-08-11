import React, { useState } from 'react';
import {
  AppStep,
  CandidateRoot,
  ExtractedFileItem,
  GitHubUser,
  RepoConfig,
  UploadProgress,
  VerificationResult,
} from './types';
import { Header } from './components/Header';
import { ZipUploadStep } from './components/ZipUploadStep';
import { RootDetectionStep } from './components/RootDetectionStep';
import { FileReviewStep } from './components/FileReviewStep';
import { GitHubConfigStep } from './components/GitHubConfigStep';
import { UploadProgressStep } from './components/UploadProgressStep';
import { FinalResultStep } from './components/FinalResultStep';
import { analyzeZipFile, extractFilesFromRoot, ZipAnalysisResult } from './utils/zipAnalyzer';
import { createGitHubRepository, uploadProjectToGitHub, verifyGitHubRepositoryTree } from './utils/githubApi';

export default function App() {
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

  // GitHub Setup State
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repoConfig, setRepoConfig] = useState<RepoConfig | null>(null);

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

  // Step 3: Confirm Files & Go to GitHub Config
  const handleConfirmFileReview = () => {
    setStep('github-config');
  };

  // Step 4: Start Upload Process
  const handleStartUpload = async (config: RepoConfig) => {
    if (!user || !token) return;

    setRepoConfig(config);
    setStep('uploading');

    // Filter files to upload
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
    if (!user || !token || !repoConfig) return;
    handleStartUpload(repoConfig);
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
    setUploadProgress(null);
    setVerificationResult(null);
    setCreatedRepoUrl('');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      <Header currentStep={step} onReset={handleReset} />

      <main className="flex-1 pb-16">
        {step === 'upload' && (
          <ZipUploadStep
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

        {step === 'uploading' && uploadProgress && (
          <UploadProgressStep
            progress={uploadProgress}
            onRetryFailed={handleRetryFailed}
            onProceedToVerification={() => setStep('completed')}
          />
        )}

        {step === 'completed' && user && repoConfig && (
          <FinalResultStep
            repoUrl={createdRepoUrl}
            repoConfig={repoConfig}
            user={user}
            verification={verificationResult}
            uploadedCount={uploadProgress?.successfulCount || 0}
            skippedCount={extractedFiles.filter((f) => f.isExcluded).length}
            failedCount={uploadProgress?.failedCount || 0}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}
