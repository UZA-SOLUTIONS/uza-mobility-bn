import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StorageService } from '../../common/uploads/storage.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { AdminCreatePartDto } from './dto/admin-create-part.dto';
import { FilterPartsDto } from './dto/filter-parts.dto';
import { AdminUpdatePartDto } from './dto/admin-update-part.dto';
import { RejectPartDto } from './dto/reject-part.dto';
import { PartsService } from './parts.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/parts')
@UseGuards(RolesGuard)
@Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
export class AdminPartsController {
  constructor(
    private readonly partsService: PartsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'List all parts' })
  findAll(@Query() filters: FilterPartsDto) {
    return this.partsService.adminFindAll(filters);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'Part detail (admin)' })
  findOne(@Param('id') id: string) {
    return this.partsService.adminFindById(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @UseInterceptors(FilesInterceptor('photos', 10, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      photos: { type: 'array', items: { type: 'string', format: 'binary' } },
    }),
  })
  @ApiOperation({ summary: 'Create part (admin)' })
  async create(
    @Body('payload') payload: string,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    const dto = await parseMultipartPayload(AdminCreatePartDto, payload);
    const photoUrls = photos?.length
      ? this.storage.urlsFromAssets(
          await this.storage.uploadImages(photos, UploadFolder.PARTS),
        )
      : undefined;
    return this.partsService.adminCreate({
      ...dto,
      ...(photoUrls ? { photoUrls } : {}),
    });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
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
  @ApiOperation({ summary: 'Update part (admin)' })
  async update(
    @Param('id') id: string,
    @Body('payload') payload: string | undefined,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    const dto = payload?.trim()
      ? await parseMultipartPayload(AdminUpdatePartDto, payload)
      : {};
    const photoUrls = photos?.length
      ? this.storage.urlsFromAssets(
          await this.storage.uploadImages(photos, UploadFolder.PARTS),
        )
      : undefined;
    return this.partsService.adminUpdate(id, {
      ...dto,
      ...(photoUrls ? { photoUrls } : {}),
    });
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'Permanently delete part' })
  remove(@Param('id') id: string) {
    return this.partsService.adminDelete(id);
  }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve part listing (administrator only)' })
  approve(@Param('id') id: string) {
    return this.partsService.adminApprove(id);
  }

  @Patch(':id/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject part listing (administrator only)' })
  reject(@Param('id') id: string, @Body() dto: RejectPartDto) {
    return this.partsService.adminReject(id, dto);
  }

  @Patch(':id/activate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'Activate approved part listing' })
  activate(@Param('id') id: string) {
    return this.partsService.adminSetActive(id, true);
  }

  @Patch(':id/deactivate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'Deactivate part listing' })
  deactivate(@Param('id') id: string) {
    return this.partsService.adminSetActive(id, false);
  }
}
