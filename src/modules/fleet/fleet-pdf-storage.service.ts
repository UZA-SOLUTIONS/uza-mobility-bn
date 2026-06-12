import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/uploads/storage.service';
import { UploadFolder } from '../../common/uploads/upload.constants';

@Injectable()
export class FleetPdfStorageService {
  constructor(private readonly storage: StorageService) {}

  async saveFleetPdf(referenceNumber: string, buffer: Buffer): Promise<string> {
    const filename = `${referenceNumber.replace(/\//g, '-')}.pdf`;

    const asset = await this.storage.uploadBuffer(
      buffer,
      UploadFolder.QUOTES,
      filename,
      'application/pdf',
    );

    return asset.url;
  }
}
