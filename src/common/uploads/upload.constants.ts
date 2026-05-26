export const UPLOAD_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const UPLOAD_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const;

export const UPLOAD_DOCUMENT_MIME_TYPES = [
  ...UPLOAD_IMAGE_MIME_TYPES,
  'application/pdf',
] as const;

export enum UploadFolder {
  PARTS = 'parts',
  CATEGORIES = 'categories',
  LISTINGS = 'listings',
  ENERGY = 'energy',
  PAYMENTS = 'payments',
  PROMOTIONS = 'promotions',
  VERIFICATION = 'verification',
  PROFILES = 'profiles',
  GENERAL = 'general',
}
