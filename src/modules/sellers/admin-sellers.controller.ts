import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
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
import { FilterSellersDto } from './dto/filter-sellers.dto';
import { SuspendSellerDto } from './dto/suspend-seller.dto';
import { SellersService } from './sellers.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/sellers')
@UseGuards(RolesGuard)
@Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
export class AdminSellersController {
  constructor(private readonly sellersService: SellersService) {}

  private requireAdmin(
    request: AuthenticatedRequest,
    handler: (
      adminId: string,
      ctx: ReturnType<typeof getRequestAuditContext>,
    ) => unknown,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return handler(userId, getRequestAuditContext(request));
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('sellers:verify')
  @ApiOperation({ summary: 'List sellers (marketplace admin)' })
  findAll(@Query() filters: FilterSellersDto) {
    return this.sellersService.adminFindAll(filters);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('sellers:verify')
  @ApiOperation({ summary: 'Seller detail' })
  findOne(@Param('id') id: string) {
    return this.sellersService.adminFindById(id);
  }

  @Patch(':id/verify')
  @UseGuards(PermissionsGuard)
  @RequirePermission('sellers:verify')
  @ApiOperation({
    summary: 'Verify seller — sets ACTIVE, isVerified, ensures SELLER role',
  })
  verify(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.sellersService.verifySeller(id, adminId, ctx),
    );
  }

  @Patch(':id/suspend')
  @UseGuards(PermissionsGuard)
  @RequirePermission('sellers:suspend')
  @ApiOperation({ summary: 'Suspend seller — blocks new listing activity' })
  suspend(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SuspendSellerDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.sellersService.suspendSeller(id, adminId, dto, ctx),
    );
  }

  @Patch(':id/reactivate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('sellers:suspend')
  @ApiOperation({ summary: 'Reactivate a suspended seller' })
  reactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.sellersService.reactivateSeller(id, adminId, ctx),
    );
  }
}
