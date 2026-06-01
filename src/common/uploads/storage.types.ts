export type UploadedAsset = {
  /** Public URL clients store in the database. */
  url: string;
  /** Relative path under the upload root (for deletion). */
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};
