import { FileStatus, SensitiveMatch } from '../types';

// Sensitive filename patterns
const SENSITIVE_FILENAME_REGEX = /^(?:\.env(?:\..*)?|credentials\.json|service-account\.json|.*\.pem|.*\.key|.*\.p12|.*\.pfx|id_rsa|id_ed25519|id_dsa|secrets\.json|secrets\.yaml|client_secret\.json)$/i;

// Generated / build / dependency directory patterns
const RECOMMENDED_EXCLUDE_REGEX = /(?:^|\/)(?:node_modules|\.next|dist|build|coverage|\.cache|\.turbo|\.venv|venv|__pycache__|\.DS_Store|Thumbs\.db|\.idea|\.vscode|\.git|\.angular|\.output)(?:\/|$)/i;

// Secret content detection patterns
const SECRET_PATTERNS = [
  {
    type: 'Private Key',
    regex: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PRIVATE) KEY-----/,
  },
  {
    type: 'AWS Access Key',
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
  },
  {
    type: 'GitHub Token',
    regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b/,
  },
  {
    type: 'Generic API Key / Secret',
    regex: /\b(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]{24,})\b/,
  },
  {
    type: 'Assigned Secret in Code',
    regex: /\b(?:API_KEY|SECRET_KEY|DB_PASSWORD|AWS_SECRET_ACCESS_KEY|PRIVATE_KEY)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.\$\!\#\%]{8,})["']?/i,
  },
];

// File size constants (in bytes)
export const MAX_FILE_SIZE_LIMIT = 100 * 1024 * 1024; // 100 MB max for GitHub file
export const WARN_FILE_SIZE_LIMIT = 25 * 1024 * 1024; // 25 MB warning

/**
 * Checks if a file path belongs to a build / dependency directory recommended to exclude.
 */
export function isRecommendedExclude(path: string): boolean {
  return RECOMMENDED_EXCLUDE_REGEX.test(path);
}

/**
 * Checks if a filename matches sensitive patterns (.env, credentials, keys).
 */
export function isSensitiveFileName(fileName: string): boolean {
  return SENSITIVE_FILENAME_REGEX.test(fileName);
}

/**
 * Scans text content for embedded secrets.
 */
export function scanTextForSecrets(text: string): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];

  for (const item of SECRET_PATTERNS) {
    const match = item.regex.exec(text);
    if (match) {
      const full = match[0];
      // Mask value for display
      let masked = full;
      if (full.length > 8) {
        masked = full.slice(0, 4) + '...' + full.slice(-4);
      } else {
        masked = '***';
      }
      matches.push({
        type: item.type,
        pattern: item.regex.source,
        maskedSnippet: masked,
      });
    }
  }

  return matches;
}

/**
 * Validates a single file and determines its status.
 */
export function validateFileStatus(
  fileName: string,
  filePath: string,
  size: number,
  isBinary: boolean,
  textBuffer?: string
): {
  status: FileStatus;
  statusMessage?: string;
  sensitiveMatches?: SensitiveMatch[];
  isRecommendedExclude: boolean;
} {
  const recommendedExclude = isRecommendedExclude(filePath);

  // Check size limits
  if (size > MAX_FILE_SIZE_LIMIT) {
    return {
      status: 'error',
      statusMessage: `File exceeds GitHub 100MB limit (${(size / (1024 * 1024)).toFixed(1)}MB)`,
      isRecommendedExclude: recommendedExclude,
    };
  }

  // Check sensitive filename
  const sensitiveByName = isSensitiveFileName(fileName);
  let sensitiveMatches: SensitiveMatch[] = [];

  if (sensitiveByName) {
    sensitiveMatches.push({
      type: 'Sensitive File Name',
      pattern: fileName,
      maskedSnippet: fileName,
    });
  }

  // Scan text for secrets if not binary
  if (!isBinary && textBuffer) {
    const textMatches = scanTextForSecrets(textBuffer);
    if (textMatches.length > 0) {
      sensitiveMatches = [...sensitiveMatches, ...textMatches];
    }
  }

  if (sensitiveMatches.length > 0) {
    return {
      status: 'sensitive',
      statusMessage: 'Contains sensitive file name or potential secrets',
      sensitiveMatches,
      isRecommendedExclude: recommendedExclude,
    };
  }

  if (recommendedExclude) {
    return {
      status: 'warning',
      statusMessage: 'Build/dependency file (recommended to exclude)',
      isRecommendedExclude: true,
    };
  }

  if (size > WARN_FILE_SIZE_LIMIT) {
    return {
      status: 'warning',
      statusMessage: `Large file (${(size / (1024 * 1024)).toFixed(1)}MB)`,
      isRecommendedExclude: false,
    };
  }

  return {
    status: 'ready',
    statusMessage: 'Ready to upload',
    isRecommendedExclude: false,
  };
}
