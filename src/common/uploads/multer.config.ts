import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import {
  UPLOAD_DOCUMENT_MIME_TYPES,
  UPLOAD_IMAGE_MIME_TYPES,
  UPLOAD_MAX_FILE_BYTES,
} from './upload.constants';

function fileFilter(allowed: readonly string[]) {
  return (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!allowed.includes(file.mimetype)) {
      callback(
        new BadRequestException(
          `Unsupported file type: ${file.mimetype}. Allowed: ${allowed.join(', ')}`,
        ),
        false,
      );
      return;
    }
    callback(null, true);
  };
}

export const imageMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_FILE_BYTES },
  fileFilter: fileFilter(UPLOAD_IMAGE_MIME_TYPES),
};

export const documentMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_FILE_BYTES },
  fileFilter: fileFilter(UPLOAD_DOCUMENT_MIME_TYPES),
};
