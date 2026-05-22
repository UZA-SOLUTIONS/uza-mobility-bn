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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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
  constructor(private readonly promotionsService: PromotionsService) {}

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

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:create')
  @ApiOperation({ summary: 'Create promotion' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.promotionsService.create(dto, adminId, ctx),
    );
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('promotions:manage')
  @ApiOperation({ summary: 'Update promotion' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.promotionsService.update(id, dto, adminId, ctx),
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
