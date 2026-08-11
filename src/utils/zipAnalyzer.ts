import JSZip from 'jszip';
import { CandidateRoot, ExtractedFileItem } from '../types';
import { validateFileStatus } from './fileValidator';
import { isBinaryFile, normalizePath, validateZipPath } from './pathUtils';

// Root indicator filenames / directory names
const ROOT_INDICATOR_FILES = new Set([
  'package.json',
  'index.html',
  'readme.md',
  'readme.txt',
  'readme',
  'tsconfig.json',
  'jsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'cargo.toml',
  'go.mod',
  'pom.xml',
  'requirements.txt',
  'pyproject.toml',
  'build.gradle',
  '.gitignore',
  'makefile',
  'dockerfile',
  'angular.json',
  'deno.json',
  'gemfile',
  'composer.json'
]);

const ROOT_INDICATOR_DIRS = new Set([
  'src',
  'public',
  'app',
  'pages',
  'components',
  'lib',
  'routes',
  'views',
  'api'
]);

// Safety thresholds
const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024; // 500 MB max total size
const MAX_TOTAL_FILES = 10000; // 10,000 files max

export interface ZipAnalysisResult {
  zipName: string;
  zipSize: number;
  totalEntries: number;
  detectedRoot: CandidateRoot;
  candidateRoots: CandidateRoot[];
  hasMultipleRoots: boolean;
  rawEntries: {
    path: string;
    zipEntry: JSZip.JSZipObject;
  }[];
  warningMessage?: string;
}

/**
 * Analyzes an uploaded ZIP file buffer.
 * Extracts metadata, validates paths, and detects candidate project roots.
 */
export async function analyzeZipFile(file: File): Promise<ZipAnalysisResult> {
  const zip = new JSZip();
  let zipContent: JSZip;

  try {
    const arrayBuffer = await file.arrayBuffer();
    zipContent = await zip.loadAsync(arrayBuffer);
  } catch (err) {
    throw new Error('Failed to parse ZIP archive. The file may be corrupted or not a valid ZIP file.');
  }

  const rawEntries: { path: string; zipEntry: JSZip.JSZipObject }[] = [];
  let totalUncompressedSize = 0;
  let fileCount = 0;

  // Track directories and file paths
  const dirFilesMap = new Map<string, string[]>(); // dirPath -> list of relative filenames
  const dirSubdirsMap = new Map<string, Set<string>>(); // dirPath -> list of immediate subdirs

  // Process and validate every entry
  for (const [relativePath, entry] of Object.entries(zipContent.files)) {
    const normPath = normalizePath(relativePath);
    if (!normPath) continue;

    // Validate path security (ZIP Slip)
    const validation = validateZipPath(normPath);
    if (!validation.valid) {
      console.warn(`Skipping invalid ZIP entry "${relativePath}": ${validation.reason}`);
      continue;
    }

    if (entry.dir) {
      // Record directory
      continue;
    }

    fileCount++;
    if (fileCount > MAX_TOTAL_FILES) {
      throw new Error(`ZIP archive exceeds maximum supported file count (${MAX_TOTAL_FILES} files).`);
    }

    // Estimate uncompressed size (approx)
    const entrySize = (entry as any)._data?.uncompressedSize || 0;
    totalUncompressedSize += entrySize;

    if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
      throw new Error(`ZIP archive exceeds maximum supported total uncompressed size (500 MB).`);
    }

    rawEntries.push({
      path: normPath,
      zipEntry: entry,
    });

    // Populate dir mapping for root detection
    const parts = normPath.split('/');
    const fileName = parts.pop()!;
    const parentDir = parts.join('/'); // "" if top-level

    if (!dirFilesMap.has(parentDir)) {
      dirFilesMap.set(parentDir, []);
    }
    dirFilesMap.get(parentDir)!.push(fileName);

    // Build directory hierarchy
    let currentDir = '';
    for (let i = 0; i < parts.length; i++) {
      const parent = currentDir;
      const child = parts[i];
      currentDir = currentDir ? `${currentDir}/${child}` : child;

      if (!dirSubdirsMap.has(parent)) {
        dirSubdirsMap.set(parent, new Set());
      }
      dirSubdirsMap.get(parent)!.add(child);
    }
  }

  if (rawEntries.length === 0) {
    throw new Error('ZIP archive is empty or contains no valid files.');
  }

  // Detect candidate project roots
  const candidateRootsMap = new Map<string, CandidateRoot>();

  // Ensure "" (ZIP root) is always a candidate
  const allDirs = new Set<string>(['', ...dirFilesMap.keys(), ...dirSubdirsMap.keys()]);

  for (const dirPath of allDirs) {
    const files = dirFilesMap.get(dirPath) || [];
    const subdirs = Array.from(dirSubdirsMap.get(dirPath) || []);

    const indicatorsFound: string[] = [];
    let score = 0;

    // Check indicator files
    for (const f of files) {
      const lowerF = f.toLowerCase();
      if (ROOT_INDICATOR_FILES.has(lowerF)) {
        indicatorsFound.push(f);
        score += lowerF === 'package.json' ? 10 : 3;
      }
    }

    // Check indicator subdirectories
    for (const sd of subdirs) {
      const lowerSd = sd.toLowerCase();
      if (ROOT_INDICATOR_DIRS.has(lowerSd)) {
        indicatorsFound.push(`${sd}/`);
        score += 2;
      }
    }

    // Count total files under this directory
    let filesUnderDir = 0;
    const prefix = dirPath ? `${dirPath}/` : '';
    for (const e of rawEntries) {
      if (!dirPath || e.path.startsWith(prefix)) {
        filesUnderDir++;
      }
    }

    // If dir contains files or has indicators or is top level single dir
    if (score > 0 || dirPath === '' || filesUnderDir > 0) {
      const parts = dirPath ? dirPath.split('/') : [];
      candidateRootsMap.set(dirPath, {
        path: dirPath,
        name: dirPath ? parts[parts.length - 1] : 'ZIP Root (No subfolder)',
        depth: parts.length,
        indicatorScore: score,
        indicatorsFound,
        fileCount: filesUnderDir,
      });
    }
  }

  // Sort candidate roots by score descending, depth ascending
  const candidateRoots = Array.from(candidateRootsMap.values()).sort((a, b) => {
    if (b.indicatorScore !== a.indicatorScore) {
      return b.indicatorScore - a.indicatorScore;
    }
    return a.depth - b.depth;
  });

  // Determine top level directories
  const topLevelDirs = Array.from(dirSubdirsMap.get('') || []);
  const filesInZipRoot = dirFilesMap.get('') || [];

  let detectedRoot: CandidateRoot;
  let hasMultipleRoots = false;
  let warningMessage: string | undefined;

  // Case 1: Exactly one top-level directory and no files at root level
  if (topLevelDirs.length === 1 && filesInZipRoot.length === 0) {
    const singleTopDir = topLevelDirs[0];
    const topDirCandidate = candidateRootsMap.get(singleTopDir);

    // Also check if there's a higher scoring candidate inside this directory
    const innerCandidates = candidateRoots.filter((c) => c.path.startsWith(`${singleTopDir}/`) && c.indicatorScore > 0);

    if (innerCandidates.length > 0 && innerCandidates[0].indicatorScore > (topDirCandidate?.indicatorScore || 0)) {
      detectedRoot = innerCandidates[0];
      warningMessage = `Detected nested project root inside "${detectedRoot.path}".`;
    } else if (topDirCandidate) {
      detectedRoot = topDirCandidate;
    } else {
      detectedRoot = candidateRoots[0] || {
        path: singleTopDir,
        name: singleTopDir,
        depth: 1,
        indicatorScore: 0,
        indicatorsFound: [],
        fileCount: rawEntries.length,
      };
    }
  } else if (candidateRoots.length > 0 && candidateRoots[0].indicatorScore > 0) {
    // Highest score candidate
    detectedRoot = candidateRoots[0];

    // Check if there are multiple candidates with similar scores
    const topScore = detectedRoot.indicatorScore;
    const contenders = candidateRoots.filter((c) => c.indicatorScore === topScore && c.path !== detectedRoot.path);
    if (contenders.length > 0) {
      hasMultipleRoots = true;
      warningMessage = 'Multiple possible project roots detected. Please review or select the correct root folder below.';
    }
  } else {
    // Default to ZIP root
    detectedRoot = candidateRootsMap.get('') || {
      path: '',
      name: 'ZIP Root',
      depth: 0,
      indicatorScore: 0,
      indicatorsFound: [],
      fileCount: rawEntries.length,
    };
  }

  return {
    zipName: file.name,
    zipSize: file.size,
    totalEntries: rawEntries.length,
    detectedRoot,
    candidateRoots,
    hasMultipleRoots,
    rawEntries,
    warningMessage,
  };
}

/**
 * Extracts all files from raw ZIP entries based on selected root and folder preservation options.
 */
export async function extractFilesFromRoot(
  rawEntries: { path: string; zipEntry: JSZip.JSZipObject }[],
  rootPath: string,
  preserveFolder: boolean,
  onProgress?: (processed: number, total: number) => void
): Promise<ExtractedFileItem[]> {
  const items: ExtractedFileItem[] = [];
  const rootPrefix = rootPath ? (rootPath.endsWith('/') ? rootPath : `${rootPath}/`) : '';

  let count = 0;
  for (const item of rawEntries) {
    count++;
    if (onProgress && count % 10 === 0) {
      onProgress(count, rawEntries.length);
    }

    // Filter files under rootPath unless rootPath is empty
    if (rootPath && !item.path.startsWith(rootPrefix) && item.path !== rootPath) {
      continue;
    }

    // Compute normalized relative path
    let relativePath = item.path;
    if (rootPath && item.path.startsWith(rootPrefix)) {
      relativePath = item.path.slice(rootPrefix.length);
    }

    if (preserveFolder && rootPath) {
      // Keep root folder name in front
      const rootName = rootPath.split('/').pop() || rootPath;
      relativePath = `${rootName}/${relativePath}`;
    }

    if (!relativePath) continue;

    // Read content as ArrayBuffer
    const arrayBuffer = await item.zipEntry.async('arraybuffer');
    const fileName = relativePath.split('/').pop() || relativePath;
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';

    const binary = isBinaryFile(fileName, arrayBuffer);
    let textContent: string | undefined;

    if (!binary) {
      try {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        textContent = decoder.decode(arrayBuffer);
      } catch {
        // Fallback
      }
    }

    // Validate file status and sensitivity
    const validation = validateFileStatus(
      fileName,
      relativePath,
      arrayBuffer.byteLength,
      binary,
      textContent
    );

    items.push({
      id: `${relativePath}-${count}`,
      originalPath: item.path,
      normalizedPath: relativePath,
      fileName,
      extension: ext,
      size: arrayBuffer.byteLength,
      isDir: false,
      content: arrayBuffer,
      status: validation.status,
      statusMessage: validation.statusMessage,
      sensitiveMatches: validation.sensitiveMatches,
      isRecommendedExclude: validation.isRecommendedExclude,
      isExcluded: validation.isRecommendedExclude, // Exclude node_modules/build by default
      isBinary: binary,
    });
  }

  return items;
}
