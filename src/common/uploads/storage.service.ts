import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { MongoService } from '../../mongo/mongo.service';
import { UploadFolder } from './upload.constants';
import {
  gridFsDeleteByFilename,
  gridFsFindByFilename,
  gridFsOpenDownloadStream,
  gridFsUploadBuffer,
  normalizePublicId,
} from './gridfs.util';
import { UPLOAD_URL_PREFIX } from './storage.paths';
import type { UploadedAsset } from './storage.types';

@Injectable()
export class StorageService implements OnModuleInit {
  private publicBaseUrl = '';

  constructor(
    private readonly config: ConfigService,
    private readonly mongo: MongoService,
  ) {}

  onModuleInit() {
    const port = this.config.get<number>('PORT', 7000);
    const configuredBase = this.config.get<string>('PUBLIC_UPLOAD_BASE_URL');
    this.publicBaseUrl = (
      configuredBase?.trim() || `http://localhost:${port}${UPLOAD_URL_PREFIX}`
    ).replace(/\/$/, '');
  }

  getPublicBaseUrl(): string {
    return this.publicBaseUrl;
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: UploadFolder,
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<UploadedAsset> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file upload');
    }

    const extension = this.extensionForFile(file, resourceType);
    const publicId = `${folder}/${randomUUID()}${extension}`;
    const bucket = this.mongo.getUploadsBucket();

    const { bytes } = await gridFsUploadBuffer(bucket, publicId, file.buffer, {
      contentType: file.mimetype,
      folder,
      originalName: file.originalname,
    });

    return {
      url: this.toPublicUrl(publicId),
      publicId,
      bytes,
      format: extension.replace(/^\./, '') || undefined,
    };
  }

  async uploadImages(
    files: Express.Multer.File[],
    folder: UploadFolder,
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<UploadedAsset[]> {
    if (!files?.length) return [];
    return Promise.all(
      files.map((file) => this.uploadImage(file, folder, resourceType)),
    );
  }

  async uploadImagesOrThrow(
    files: Express.Multer.File[],
    folder: UploadFolder,
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<UploadedAsset[]> {
    if (!files?.length) {
      return [];
    }

    for (const file of files) {
      if (!file.buffer?.length) {
        throw new BadRequestException(
          `"${file.originalname}" is empty or could not be read. Use JPEG, PNG, or WebP under 5MB.`,
        );
      }
    }

    try {
      return await this.uploadImages(files, folder, resourceType);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const detail =
        error instanceof Error ? error.message : 'Unknown upload error';
      throw new BadRequestException(`File upload failed: ${detail}`);
    }
  }

  urlsFromAssets(assets: UploadedAsset[]): string[] {
    return assets.map((asset) => asset.url);
  }

  async streamPublicFile(publicId: string, res: Response): Promise<void> {
    const key = normalizePublicId(publicId);
    if (!key || key.includes('..')) {
      throw new NotFoundException('File not found');
    }

    const bucket = this.mongo.getUploadsBucket();
    const file = await gridFsFindByFilename(bucket, key);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const metadata = file.metadata as { contentType?: string } | undefined;
    res.setHeader(
      'Content-Type',
      metadata?.contentType ?? 'application/octet-stream',
    );
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const stream = gridFsOpenDownloadStream(bucket, file);
    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      res.on('error', reject);
      res.on('finish', resolve);
      stream.pipe(res);
    });
  }

  async deleteByUrl(url: string | null | undefined): Promise<void> {
    const publicId = this.publicIdFromUrl(url);
    if (!publicId) return;
    await this.deleteByPublicId(publicId);
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    if (!publicId || publicId.includes('..')) {
      return;
    }

    await gridFsDeleteByFilename(
      this.mongo.getUploadsBucket(),
      normalizePublicId(publicId),
    );
  }

  publicIdFromUrl(url: string | null | undefined): string | null {
    if (!url?.trim()) return null;
    const prefix = `${this.publicBaseUrl}/`;
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length);
    }
    if (url.startsWith(UPLOAD_URL_PREFIX + '/')) {
      return url.slice(UPLOAD_URL_PREFIX.length + 1);
    }
    return null;
  }

  private toPublicUrl(publicId: string): string {
    return `${this.publicBaseUrl}/${publicId.replace(/\\/g, '/')}`;
  }

  private extensionForFile(
    file: Express.Multer.File,
    resourceType: 'image' | 'raw',
  ): string {
    const mime = file.mimetype?.toLowerCase() ?? '';
    const fromMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/pjpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/heic': '.heic',
      'image/heif': '.heif',
      'application/pdf': '.pdf',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
    };

    if (fromMime[mime]) {
      return fromMime[mime];
    }

    if (resourceType === 'raw') {
      return '.bin';
    }

    const fromName = file.originalname?.match(/\.[a-z0-9]+$/i)?.[0];
    return fromName?.toLowerCase() ?? '.jpg';
  }
}
