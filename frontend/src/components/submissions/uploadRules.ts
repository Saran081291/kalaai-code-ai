/** Client-side upload rules — mirror backend MAX_UPLOAD_MB / MAX_UPLOAD_FILES / extension allowlist. */

export const MAX_UPLOAD_MB = 5;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_UPLOAD_FILES = 50;

export const ALLOWED_CODE_EXTENSIONS = [
  '.py',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.go',
  '.rb',
  '.php',
  '.html',
  '.css',
  '.sql',
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
] as const;

export const ZIP_EXTENSION = '.zip';

/** Value for the file input's `accept` attribute. */
export const UPLOAD_ACCEPT = [...ALLOWED_CODE_EXTENSIONS, ZIP_EXTENSION].join(',');

const ALLOWED_SET: ReadonlySet<string> = new Set(ALLOWED_CODE_EXTENSIONS);

/** GitHub repo URL (public repo root), same pattern as the backend. */
export const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

export function isValidGithubUrl(url: string): boolean {
  return GITHUB_URL_REGEX.test(url.trim());
}

/** Lower-cased extension including the dot ("" when none). */
export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) return '';
  return fileName.slice(dot).toLowerCase();
}

export function isZip(file: File): boolean {
  return getExtension(file.name) === ZIP_EXTENSION;
}

/** Human-readable size, e.g. "512 B", "12.3 KB", "4.80 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Validate a selection of files for upload. Returns a list of precise, user-facing
 * error messages (empty list = valid). An empty selection is NOT reported here.
 */
export function validateUploadFiles(files: readonly File[]): string[] {
  const errors: string[] = [];
  if (files.length === 0) return errors;

  const zips = files.filter(isZip);
  const others = files.filter((file) => !isZip(file));

  if (zips.length > 0 && others.length > 0) {
    errors.push('Upload either one .zip file or individual code files — not both together.');
  } else if (zips.length > 1) {
    errors.push(`Only one .zip file is allowed (you added ${zips.length}).`);
  }

  const unsupported = others.filter((file) => !ALLOWED_SET.has(getExtension(file.name)));
  if (unsupported.length > 0) {
    const names = unsupported.map((file) => file.name).join(', ');
    errors.push(
      `Unsupported file type: ${names}. Allowed: ${ALLOWED_CODE_EXTENSIONS.join(' ')} or a single .zip.`,
    );
  }

  if (files.length > MAX_UPLOAD_FILES) {
    errors.push(
      `Too many files: ${files.length} selected — the limit is ${MAX_UPLOAD_FILES}. Zip them into one .zip instead.`,
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_UPLOAD_BYTES) {
    errors.push(`Total size is ${formatBytes(totalBytes)} — the limit is ${MAX_UPLOAD_MB} MB.`);
  }

  return errors;
}
