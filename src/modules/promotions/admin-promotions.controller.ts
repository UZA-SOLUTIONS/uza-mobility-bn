import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CloudinaryService } from '../../common/uploads/cloudinary.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { AttachPromotionDto } from './dto/attach-promotion.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/promotions')
@UseGuards(RolesGuard)
@Roles('ADVERTISING_ADMIN', 'SUPER_ADMIN')
export class AdminPromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private requireAdmin(
    request: AuthenticatedRequest,
    handler: (
      adminId: string,
      ctx: ReturnType<typeof getRequestAuditContext>,
    ) => unknown,
  ) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return handler(userId, getRequestAuditContext(request));
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:create')
  @ApiOperation({ summary: 'List all promotions' })
  findAll() {
    return this.promotionsService.findAllAdmin();
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:create')
  @ApiOperation({ summary: 'Promotion detail with attached listings' })
  findOne(@Param('id') id: string) {
    return this.promotionsService.findOneAdmin(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:create')
  @UseInterceptors(FileInterceptor('banner', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      banner: { type: 'string', format: 'binary', description: 'Banner image' },
    }),
  })
  @ApiOperation({ summary: 'Create promotion' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body('payload') payload: string,
    @UploadedFile() banner?: Express.Multer.File,
  ) {
    return this.requireAdmin(request, async (adminId, ctx) => {
      const dto = await parseMultipartPayload(CreatePromotionDto, payload);
      const bannerImageUrl = banner
        ? (await this.cloudinary.uploadImage(banner, UploadFolder.PROMOTIONS))
            .url
        : undefined;
      return this.promotionsService.create(
        { ...dto, bannerImageUrl },
        adminId,
        ctx,
      );
    });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:manage')
  @UseInterceptors(FileInterceptor('banner', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema(
      { banner: { type: 'string', format: 'binary' } },
      [],
    ),
  })
  @ApiOperation({ summary: 'Update promotion' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('payload') payload: string | undefined,
    @UploadedFile() banner?: Express.Multer.File,
  ) {
    return this.requireAdmin(request, async (adminId, ctx) => {
      const dto = payload?.trim()
        ? await parseMultipartPayload(UpdatePromotionDto, payload)
        : {};
      const bannerImageUrl = banner
        ? (await this.cloudinary.uploadImage(banner, UploadFolder.PROMOTIONS))
            .url
        : undefined;
      return this.promotionsService.update(
        id,
        { ...dto, bannerImageUrl },
        adminId,
        ctx,
      );
    });
  }

  @Patch(':id/activate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:manage')
  @ApiOperation({ summary: 'Reactivate a deactivated promotion' })
  activate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.promotionsService.activate(id, adminId, ctx),
    );
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:manage')
  @ApiOperation({ summary: 'Deactivate promotion' })
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.promotionsService.deactivate(id, adminId, ctx),
    );
  }

  @Post(':id/listings')
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:manage')
  @ApiOperation({ summary: 'Attach listings to promotion' })
  attach(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AttachPromotionDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.promotionsService.attachListings(id, dto, adminId, ctx),
    );
  }

  @Delete(':id/listings/:listingId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:manage')
  @ApiOperation({ summary: 'Detach listing from promotion' })
  detach(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('listingId') listingId: string,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.promotionsService.detachListing(id, listingId, adminId, ctx),
    );
  }
}
