import {
  BadRequestException,
  HttpException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { UploadFolder } from './upload.constants';
import { resolveUploadRoot, UPLOAD_URL_PREFIX } from './storage.paths';
import type { UploadedAsset } from './storage.types';

@Injectable()
export class StorageService implements OnModuleInit {
  private uploadRoot = '';
  private publicBaseUrl = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.uploadRoot = resolveUploadRoot(this.config.get<string>('UPLOAD_ROOT'));
    const port = this.config.get<number>('PORT', 7000);
    const configuredBase = this.config.get<string>('PUBLIC_UPLOAD_BASE_URL');
    this.publicBaseUrl = (
      configuredBase?.trim() || `http://localhost:${port}${UPLOAD_URL_PREFIX}`
    ).replace(/\/$/, '');
  }

  getUploadRoot(): string {
    return this.uploadRoot;
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
    const absolutePath = join(this.uploadRoot, publicId);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      url: this.toPublicUrl(publicId),
      publicId,
      bytes: file.buffer.length,
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

  /** Deletes a previously uploaded file when the URL points at this server. */
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    const publicId = this.publicIdFromUrl(url);
    if (!publicId) return;
    await this.deleteByPublicId(publicId);
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    if (!publicId || publicId.includes('..')) {
      return;
    }

    const absolutePath = join(this.uploadRoot, publicId);
    try {
      await unlink(absolutePath);
    } catch {
      // File may already be gone.
    }
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
