import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';
import { imageMulterOptions } from './multer.config';
import { UploadFolder } from './upload.constants';

@ApiTags('uploads')
@ApiBearerAuth('JWT-access')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 20, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one or more images to Cloudinary' })
  @ApiQuery({
    name: 'folder',
    required: false,
    enum: UploadFolder,
    description: 'Cloudinary subfolder (default: general)',
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

    const assets = await this.cloudinary.uploadImages(files, target);
    return { items: assets };
  }
}
