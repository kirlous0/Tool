import { ExtractedFileItem } from '../types';

/**
 * Calculates the exact Git Blob SHA-1 hash for an ArrayBuffer.
 * Formula: SHA-1("blob " + byteLength + "\0" + content)
 */
export async function calculateGitBlobSha(content: ArrayBuffer): Promise<string> {
  const headerStr = `blob ${content.byteLength}\0`;
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(headerStr);

  const combined = new Uint8Array(headerBytes.byteLength + content.byteLength);
  combined.set(headerBytes, 0);
  combined.set(new Uint8Array(content), headerBytes.byteLength);

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Enriches local ExtractedFileItems with precalculated Git Blob SHA-1 hashes.
 */
export async function enrichFilesWithGitShas(
  files: ExtractedFileItem[]
): Promise<ExtractedFileItem[]> {
  const enriched = await Promise.all(
    files.map(async (f) => {
      if (f.gitBlobSha) return f;
      const sha = await calculateGitBlobSha(f.content);
      return { ...f, gitBlobSha: sha };
    })
  );
  return enriched;
}
