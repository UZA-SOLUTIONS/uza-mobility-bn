import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import { UploadFolder } from './upload.constants';

export type UploadedAsset = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private baseFolder = 'uza-mobility';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    this.baseFolder =
      this.config.get<string>('CLOUDINARY_FOLDER')?.trim() || 'uza-mobility';
  }

  private folderPath(folder: UploadFolder): string {
    return `${this.baseFolder}/${folder}`;
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: UploadFolder,
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<UploadedAsset> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file upload');
    }

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: this.folderPath(folder),
          resource_type: resourceType,
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve(uploadResult);
        },
      );
      stream.end(file.buffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
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

  urlsFromAssets(assets: UploadedAsset[]): string[] {
    return assets.map((asset) => asset.url);
  }
}
