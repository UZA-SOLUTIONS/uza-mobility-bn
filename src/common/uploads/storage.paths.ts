import { join, resolve } from 'path';

/**
 * Legacy local path helper (folder layout only — binaries live in GridFS).
 * @deprecated Files are stored in MongoDB; see storage/uploads/.gitkeep folders for layout.
 */
export function resolveUploadRoot(uploadRoot?: string): string {
  const configured = uploadRoot?.trim() || 'storage/uploads';
  return resolve(process.cwd(), configured);
}

/** URL path prefix for public file routes (GET /uploads/... streams from GridFS). */
export const UPLOAD_URL_PREFIX = '/uploads';

export function joinUploadRoot(
  uploadRoot: string,
  ...segments: string[]
): string {
  return join(resolveUploadRoot(uploadRoot), ...segments);
}

/** Base URL for uploaded assets (matches StorageService / .env PUBLIC_UPLOAD_BASE_URL). */
export function defaultPublicUploadBaseUrl(): string {
  const port = process.env.PORT?.trim() || '7000';
  const configured =
    process.env.PUBLIC_UPLOAD_BASE_URL?.trim() ||
    `http://localhost:${port}${UPLOAD_URL_PREFIX}`;
  return configured.replace(/\/$/, '');
}

/** Build a public URL for a stored file id, e.g. `listings/photo.jpg`. */
export function publicUploadUrlForPath(
  publicId: string,
  publicUploadBaseUrl = defaultPublicUploadBaseUrl(),
): string {
  return `${publicUploadBaseUrl}/${publicId.replace(/\\/g, '/')}`;
}

/**
 * Normalize DB/API photo paths to absolute URLs.
 * Handles legacy `/uploads/...` rows and full URLs from live uploads.
 */
export function toAbsoluteUploadUrl(
  url: string,
  publicUploadBaseUrl = defaultPublicUploadBaseUrl(),
): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith(`${UPLOAD_URL_PREFIX}/`)) {
    return `${publicUploadBaseUrl}${trimmed.slice(UPLOAD_URL_PREFIX.length)}`;
  }
  return trimmed;
}
