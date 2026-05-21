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
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { AdminCreateListingDto } from './dto/admin-create-listing.dto';
import { AdminFilterListingsDto } from './dto/admin-filter-listings.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
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
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all listings (admin)' })
  findAll(@Query() filters: AdminFilterListingsDto) {
    return this.listingsService.adminFindAll(filters);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:create')
  @ApiOperation({
    summary:
      'Create UZA Rwanda stock or China sourcing listing (admin only, not seller flow)',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AdminCreateListingDto,
  ) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.createByAdmin(userId, dto, ctx),
    );
  }

  @Patch(':id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:approve')
  @ApiOperation({ summary: 'Approve listing (status → APPROVED)' })
  approve(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminApprove(id, userId, ctx),
    );
  }

  @Patch(':id/publish')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:approve')
  @ApiOperation({ summary: 'Publish approved listing' })
  publish(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.listingsService.adminPublish(id, userId, ctx),
    );
  }

  @Patch(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:reject')
  @ApiOperation({ summary: 'Reject listing' })
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
  @UseGuards(PermissionsGuard)
  @RequirePermission('listings:approve')
  @ApiOperation({ summary: 'Update listing verification' })
  verification(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateVerificationDto,
  ) {
    return this.requireAdmin(request, (userId, ctx) =>
      this.verificationService.updateVerification(id, dto, userId, ctx),
    );
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
