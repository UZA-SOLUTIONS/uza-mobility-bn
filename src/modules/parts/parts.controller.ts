import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CloudinaryService } from '../../common/uploads/cloudinary.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { CreatePartDto } from './dto/create-part.dto';
import { FilterPartsDto } from './dto/filter-parts.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { PartsService } from './parts.service';

@ApiTags('parts')
@Controller('parts')
export class PartsController {
  constructor(
    private readonly partsService: PartsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Browse parts (includes out-of-stock listings)' })
  browse(@Query() filters: FilterPartsDto) {
    return this.partsService.browse(filters);
  }

  @Get('my')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:create')
  @ApiOperation({ summary: 'List own parts (includes inactive)' })
  findMine(@Req() request: AuthenticatedRequest) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.partsService.findMine(userId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Part detail' })
  findOne(@Param('id') id: string) {
    return this.partsService.findById(id);
  }

  @Post()
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:create')
  @UseInterceptors(FilesInterceptor('photos', 10, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      photos: { type: 'array', items: { type: 'string', format: 'binary' } },
    }),
  })
  @ApiOperation({ summary: 'List a new part (seller)' })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body('payload') payload: string,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const dto = await parseMultipartPayload(CreatePartDto, payload);
    const photoUrls = photos?.length
      ? this.cloudinary.urlsFromAssets(
          await this.cloudinary.uploadImages(photos, UploadFolder.PARTS),
        )
      : undefined;
    return this.partsService.createForSeller(userId, {
      ...dto,
      ...(photoUrls ? { photoUrls } : {}),
    });
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:create')
  @UseInterceptors(FilesInterceptor('photos', 10, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema(
      {
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
      [],
    ),
  })
  @ApiOperation({ summary: 'Update own part' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('payload') payload: string | undefined,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const dto = payload?.trim()
      ? await parseMultipartPayload(UpdatePartDto, payload)
      : {};
    const photoUrls = photos?.length
      ? this.cloudinary.urlsFromAssets(
          await this.cloudinary.uploadImages(photos, UploadFolder.PARTS),
        )
      : undefined;
    return this.partsService.updateOwn(userId, id, {
      ...dto,
      ...(photoUrls ? { photoUrls } : {}),
    });
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:create')
  @ApiOperation({ summary: 'Deactivate own part listing' })
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    await this.partsService.deleteOwn(userId, id);
    return { deleted: true };
  }
}
