import { join, resolve } from 'path';

/** Absolute filesystem directory for uploaded assets. */
export function resolveUploadRoot(uploadRoot?: string): string {
  const configured = uploadRoot?.trim() || 'storage/uploads';
  return resolve(process.cwd(), configured);
}

/** URL path prefix served by Express static middleware. */
export const UPLOAD_URL_PREFIX = '/uploads';

export function joinUploadRoot(
  uploadRoot: string,
  ...segments: string[]
): string {
  return join(resolveUploadRoot(uploadRoot), ...segments);
}
