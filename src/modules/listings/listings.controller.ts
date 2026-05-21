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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { AddListingPhotosDto } from './dto/add-listing-photos.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

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
  @ApiOperation({ summary: 'Add photo URLs to listing (max 20)' })
  addPhotos(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AddListingPhotosDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.listingsService.addPhotos(
      request.user.sub,
      id,
      dto,
      getRequestAuditContext(request),
    );
  }
}
