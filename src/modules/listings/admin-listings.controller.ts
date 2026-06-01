import {
  BadRequestException,
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
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { AdminCreateListingDto } from './dto/admin-create-listing.dto';
import { AdminUpdateListingDto } from './dto/admin-update-listing.dto';
import { AdminFilterListingsDto } from './dto/admin-filter-listings.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { StorageService } from '../../common/uploads/storage.service';
import {
  documentMulterOptions,
  imageMulterOptions,
} from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { ListingsService } from './listings.service';
import { VerificationService } from './verification.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/listings')
export class AdminListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly verificationService: VerificationService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all listings (admin)' })
  findAll(@Query() filters: AdminFilterListingsDto) {
    return this.listingsService.adminFindAll(filters);
  }

  @Post()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('listings:create')
  @UseInterceptors(FilesInterceptor('photos', 20, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      photos: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
    }),
  })
  @ApiOperation({
    summary:
      'Create UZA Rwanda stock or China sourcing listing (admin only, not seller flow)',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body('payload') payload: string,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    return this.requireAdmin(request, async (userId, ctx) => {
      const dto = await parseMultipartPayload(AdminCreateListingDto, payload);
      const photoUrls = photos?.length
        ? this.storage.urlsFromAssets(
            await this.storage.uploadImagesOrThrow(
              photos,
              UploadFolder.LISTINGS,
            ),
          )
        : undefined;

      return this.listingsService.createByAdmin(
        userId,
        {
          ...dto,
          ...(photoUrls ? { photoUrls } : {}),
        },
        ctx,
      );
    });
  }

  @Patch(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('listings:create')
  @UseInterceptors(FilesInterceptor('photos', 20, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      photos: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
    }),
  })
  @ApiOperation({
    summary: 'Update a platform listing you created (UZA stock/sourcing only)',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('payload') payload: string,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    return this.requireAdmin(request, async (userId, ctx) => {
      const dto = await parseMultipartPayload(AdminUpdateListingDto, payload);
      const photoUrls = photos?.length
        ? this.storage.urlsFromAssets(
            await this.storage.uploadImagesOrThrow(
              photos,
              UploadFolder.LISTINGS,
            ),
          )
        : undefined;

      return this.listingsService.updateCreatedByAdmin(
        userId,
        id,
        {
          ...dto,
          ...(photoUrls ? { photoUrls } : {}),
        },
        ctx,
      );
    });
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Approve listing (status → APPROVED, administrator only)',
  })
  approve(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminApprove(id, userId, ctx),
    );
  }

  @Patch(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Publish approved listing (administrator only)' })
  publish(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminPublish(id, userId, ctx),
    );
  }

  @Patch(':id/unpublish')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Unpublish live listing (status → SUSPENDED, administrator only)',
  })
  unpublish(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminUnpublish(id, userId, ctx),
    );
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject listing (administrator only)' })
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RejectListingDto,
  ) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminReject(id, userId, dto, ctx),
    );
  }

  @Patch(':id/feature')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:feature')
  @ApiOperation({ summary: 'Toggle featured flag' })
  feature(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminToggleFeatured(id, userId, ctx),
    );
  }

  @Patch(':id/hot-deal')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:feature')
  @ApiOperation({ summary: 'Toggle hot deal flag' })
  hotDeal(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminToggleHotDeal(id, userId, ctx),
    );
  }

  @Patch(':id/verification')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'report', maxCount: 1 },
        { name: 'batteryReport', maxCount: 1 },
      ],
      documentMulterOptions,
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      report: { type: 'string', format: 'binary' },
      batteryReport: { type: 'string', format: 'binary' },
    }),
  })
  @ApiOperation({ summary: 'Update listing verification' })
  verification(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('payload') payload: string,
    @UploadedFiles()
    files?: {
      report?: Express.Multer.File[];
      batteryReport?: Express.Multer.File[];
    },
  ) {
    return this.requireAdmin(request, async (userId, ctx) => {
      const dto = await parseMultipartPayload(UpdateVerificationDto, payload);
      const reportUrl = files?.report?.[0]
        ? (
            await this.storage.uploadImage(
              files.report[0],
              UploadFolder.VERIFICATION,
              files.report[0].mimetype === 'application/pdf' ? 'raw' : 'image',
            )
          ).url
        : undefined;
      const batteryReportUrl = files?.batteryReport?.[0]
        ? (
            await this.storage.uploadImage(
              files.batteryReport[0],
              UploadFolder.VERIFICATION,
              files.batteryReport[0].mimetype === 'application/pdf'
                ? 'raw'
                : 'image',
            )
          ).url
        : undefined;

      return this.verificationService.updateVerification(
        id,
        { ...dto, reportUrl, batteryReportUrl },
        userId,
        ctx,
      );
    });
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:delete')
  @ApiOperation({ summary: 'Hard delete listing' })
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminHardDelete(id, userId, ctx),
    );

    return { message: 'Listing permanently deleted' };
  }

  private requireAdmin<T>(
    request: AuthenticatedRequest,
    handler: (
      userId: string,
      auditContext: ReturnType<typeof getRequestAuditContext>,
    ) => Promise<T>,
  ): Promise<T> {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return handler(request.user.sub, getRequestAuditContext(request));
  }
}
