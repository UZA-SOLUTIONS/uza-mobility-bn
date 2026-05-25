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
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/decorators/public.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { CloudinaryService } from '../../common/uploads/cloudinary.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { CreateListingDto } from './dto/create-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get('featured')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Featured published listings' })
  featured() {
    return this.listingsService.featured();
  }

  @Get('new-arrivals')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Latest published listings' })
  newArrivals() {
    return this.listingsService.newArrivals();
  }

  @Get('hot-deals')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Hot deal listings' })
  hotDeals() {
    return this.listingsService.hotDeals();
  }

  @Get('local-stock')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'UZA Rwanda stock listings' })
  localStock() {
    return this.listingsService.localStock();
  }

  @Get('recently-reduced')
  @Public()
  @SkipAudit()
  @ApiOperation({
    summary: 'Published listings with active discount promotions',
  })
  recentlyReduced() {
    return this.listingsService.recentlyReduced();
  }

  @Get('my')
  @ApiBearerAuth('JWT-access')
  @UseGuards(RolesGuard)
  @Roles('SELLER', 'SUPER_ADMIN', 'MARKETPLACE_ADMIN')
  @ApiOperation({ summary: 'Seller own listings' })
  my(@Req() request: AuthenticatedRequest) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.listingsService.findMine(request.user.sub);
  }

  @Get()
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Browse published listings' })
  browse(@Query() filters: FilterListingsDto) {
    return this.listingsService.browse(filters);
  }

  @Post()
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:create')
  @ApiOperation({ summary: 'Create listing (draft)' })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateListingDto) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.listingsService.createForSeller(
      request.user.sub,
      dto,
      getRequestAuditContext(request),
    );
  }

  @Get(':slug')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Published listing detail by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.listingsService.findBySlug(slug);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:create')
  @ApiOperation({ summary: 'Update own draft/rejected listing' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.listingsService.updateOwn(
      request.user.sub,
      id,
      dto,
      getRequestAuditContext(request),
    );
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:create')
  @ApiOperation({ summary: 'Soft-delete own draft listing' })
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    await this.listingsService.deleteOwn(
      request.user.sub,
      id,
      getRequestAuditContext(request),
    );

    return { message: 'Listing deleted' };
  }

  @Post(':id/submit')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:create')
  @ApiOperation({ summary: 'Submit listing for review' })
  submit(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.listingsService.submitForReview(
      request.user.sub,
      id,
      getRequestAuditContext(request),
    );
  }

  @Post(':id/photos')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:create')
  @UseInterceptors(FilesInterceptor('photos', 20, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['photos'],
    },
  })
  @ApiOperation({ summary: 'Upload listing photos (max 20 total per listing)' })
  async addPhotos(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }
    if (!files?.length) {
      throw new BadRequestException('At least one photo file is required');
    }

    const assets = await this.cloudinary.uploadImages(
      files,
      UploadFolder.LISTINGS,
    );
    const photos = assets.map((asset, index) => ({
      url: asset.url,
      isPrimary: index === 0,
    }));

    return this.listingsService.addPhotos(
      request.user.sub,
      id,
      photos,
      getRequestAuditContext(request),
    );
  }
}
