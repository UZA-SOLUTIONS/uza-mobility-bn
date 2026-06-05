import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import {
  UPLOAD_DOCUMENT_MIME_TYPES,
  UPLOAD_IMAGE_MIME_TYPES,
  UPLOAD_MAX_FILE_BYTES,
  UPLOAD_MAX_VIDEO_BYTES,
  UPLOAD_VIDEO_MIME_TYPES,
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

export const videoMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_VIDEO_BYTES },
  fileFilter: fileFilter(UPLOAD_VIDEO_MIME_TYPES),
};

export const listingMediaMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_VIDEO_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowed: readonly string[] =
      file.fieldname === 'video'
        ? UPLOAD_VIDEO_MIME_TYPES
        : UPLOAD_IMAGE_MIME_TYPES;
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
  },
};
