import { readFileSync } from 'fs';
import { GridFSBucket, MongoClient } from 'mongodb';
import { gridFsUploadBuffer } from './gridfs.util';

export type GridFsSeedConnection = {
  client: MongoClient;
  bucket: GridFSBucket;
};

export async function connectGridFsForSeed(
  uri: string,
  options?: { dbName?: string; bucketName?: string },
): Promise<GridFsSeedConnection> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = options?.dbName ? client.db(options.dbName) : client.db();
  const bucket = new GridFSBucket(db, {
    bucketName: options?.bucketName?.trim() || 'uploads',
  });
  return { client, bucket };
}

export async function seedGridFsFileFromPath(
  bucket: GridFSBucket,
  absolutePath: string,
  publicId: string,
  contentType: string,
): Promise<void> {
  const buffer = readFileSync(absolutePath);
  await gridFsUploadBuffer(bucket, publicId, buffer, { contentType });
}

export function mimeTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
