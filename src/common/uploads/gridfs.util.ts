import { Readable } from 'stream';
import type { GridFSBucket, GridFSFile } from 'mongodb';

export type GridFsFileMetadata = {
  contentType?: string;
  folder?: string;
  originalName?: string;
};

export function normalizePublicId(publicId: string): string {
  return publicId.replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Upload or replace a file keyed by `filename` (our publicId, e.g. `listings/uuid.jpg`). */
export async function gridFsUploadBuffer(
  bucket: GridFSBucket,
  filename: string,
  buffer: Buffer,
  metadata: GridFsFileMetadata = {},
): Promise<{ bytes: number; file: GridFSFile }> {
  const key = normalizePublicId(filename);
  await gridFsDeleteByFilename(bucket, key);

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(key, { metadata });
    Readable.from(buffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        const file = uploadStream.gridFSFile;
        if (!file) {
          reject(new Error('GridFS upload finished without file metadata'));
          return;
        }
        resolve({ bytes: buffer.length, file });
      });
  });
}

export async function gridFsFindByFilename(
  bucket: GridFSBucket,
  filename: string,
): Promise<GridFSFile | null> {
  const key = normalizePublicId(filename);
  const matches = await bucket.find({ filename: key }).limit(1).toArray();
  return matches[0] ?? null;
}

export function gridFsOpenDownloadStream(
  bucket: GridFSBucket,
  file: GridFSFile,
): ReturnType<GridFSBucket['openDownloadStream']> {
  return bucket.openDownloadStream(file._id);
}

export async function gridFsDeleteByFilename(
  bucket: GridFSBucket,
  filename: string,
): Promise<void> {
  const key = normalizePublicId(filename);
  const matches = await bucket.find({ filename: key }).toArray();
  await Promise.all(matches.map((file) => bucket.delete(file._id)));
}
