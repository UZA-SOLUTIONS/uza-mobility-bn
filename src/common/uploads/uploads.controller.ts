import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Public } from '../../modules/auth/decorators/public.decorator';
import { SkipAudit } from '../audit/decorators/skip-audit.decorator';
import { StorageService } from './storage.service';
import { imageMulterOptions } from './multer.config';
import { UploadFolder } from './upload.constants';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('images')
  @ApiBearerAuth('JWT-access')
  @UseInterceptors(FilesInterceptor('files', 20, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one or more images to MongoDB GridFS' })
  @ApiQuery({
    name: 'folder',
    required: false,
    enum: UploadFolder,
    description: 'Logical folder prefix (default: general)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder?: UploadFolder,
  ) {
    if (!files?.length) {
      throw new BadRequestException(
        'At least one file is required (field: files)',
      );
    }

    const target =
      folder && Object.values(UploadFolder).includes(folder)
        ? folder
        : UploadFolder.GENERAL;

    const assets = await this.storage.uploadImages(files, target);
    return { items: assets };
  }

  @Get('*path')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Stream an uploaded file from GridFS' })
  @ApiParam({
    name: 'path',
    description: 'File key, e.g. listings/uuid.jpg',
  })
  async serveFile(
    @Param('path') path: string | string[],
    @Res() res: Response,
  ) {
    const segments = Array.isArray(path) ? path : [path];
    const publicId = segments.filter(Boolean).join('/');

    if (!publicId) {
      throw new NotFoundException('File not found');
    }

    try {
      await this.storage.streamPublicFile(publicId, res);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('File not found');
    }
  }
}
