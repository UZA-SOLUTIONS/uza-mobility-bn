import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/uploads/storage.service';
import { UploadFolder } from '../../common/uploads/upload.constants';

@Injectable()
export class QuoteStorageService {
  constructor(private readonly storage: StorageService) {}

  async saveQuotePdf(quoteNumber: string, buffer: Buffer): Promise<string> {
    const filename = `${quoteNumber.replace(/\//g, '-')}.pdf`;

    const asset = await this.storage.uploadBuffer(
      buffer,
      UploadFolder.QUOTES,
      filename,
      'application/pdf',
    );

    return asset.url;
  }

  async readQuotePdf(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null;
    return this.storage.readBufferByUrl(url);
  }
}
