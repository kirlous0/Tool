/**
 * Utility functions for path security, ZIP Slip protection, and path normalization.
 */

// File extensions commonly known to be binary
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svgz', 'tiff', 'psd',
  'pdf', 'zip', 'tar', 'gz', '7z', 'rar', 'exe', 'dll', 'so', 'dylib', 'bin',
  'wof', 'woff', 'woff2', 'ttf', 'eot', 'otf',
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'mov', 'avi', 'mkv', 'flac',
  'pyc', 'class', 'db', 'sqlite', 'sqlite3', 'iso', 'wasm'
]);

/**
 * Normalizes a ZIP entry path securely.
 * Replaces backslashes with forward slashes and collapses multi-slashes.
 */
export function normalizePath(rawPath: string): string {
  if (!rawPath) return '';
  // Replace backslashes with forward slashes
  let clean = rawPath.replace(/\\/g, '/');
  // Collapse duplicate slashes
  clean = clean.replace(/\/+/g, '/');
  // Remove leading slash if any
  if (clean.startsWith('/')) {
    clean = clean.slice(1);
  }
  return clean;
}

/**
 * Validates a ZIP path against path traversal attacks (ZIP Slip).
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateZipPath(path: string): { valid: boolean; reason?: string } {
  if (!path) {
    return { valid: false, reason: 'Empty file path' };
  }

  const normalized = normalizePath(path);

  // Check for path traversal segments
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '.') {
      return { valid: false, reason: 'Path traversal segment detected (..) in path' };
    }
  }

  // Check for absolute path markers or Windows drive letters (e.g. C:)
  if (/^[a-zA-Z]:/.test(normalized)) {
    return { valid: false, reason: 'Absolute Windows path detected' };
  }

  // Check for null bytes or suspicious control characters
  if (/[\x00-\x1F\x7F]/.test(path)) {
    return { valid: false, reason: 'Control character or null byte detected in path' };
  }

  return { valid: true };
}

/**
 * Strips the root path prefix from a full ZIP file path.
 * E.g., stripRootPrefix("my-app/src/index.ts", "my-app") -> "src/index.ts"
 */
export function stripRootPrefix(filePath: string, rootPath: string, preserveFolder: boolean = false): string {
  const normFile = normalizePath(filePath);
  const normRoot = normalizePath(rootPath);

  if (!normRoot || preserveFolder) {
    return normFile;
  }

  // Ensure root ends with a slash for exact prefix matching
  const rootPrefix = normRoot.endsWith('/') ? normRoot : `${normRoot}/`;

  if (normFile.startsWith(rootPrefix)) {
    return normFile.slice(rootPrefix.length);
  }

  if (normFile === normRoot) {
    return '';
  }

  return normFile;
}

/**
 * Checks if a file is likely binary based on extension or buffer content.
 */
export function isBinaryFile(fileName: string, buffer: ArrayBuffer): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  // Check first 1024 bytes for null bytes or high ratio of non-printable bytes
  const bytes = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 1024)));
  let nonPrintable = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 0) return true; // Null byte indicates binary
    if ((byte < 7 || byte > 14) && (byte < 32 || byte > 126)) {
      nonPrintable++;
    }
  }

  return bytes.length > 0 && nonPrintable / bytes.length > 0.3;
}

/**
 * Converts an ArrayBuffer to a Base64 string safely without stack overflow.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks to prevent RangeError: Maximum call stack size exceeded

  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

/**
 * Formats byte size into human readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
