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
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('LOGISTICS_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('orders:read')
  @ApiOperation({ summary: 'List all orders' })
  findAll(@Query() filters: FilterOrdersDto) {
    return this.ordersService.adminFindAll(filters);
  }

  @Get(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('LOGISTICS_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('orders:read')
  @ApiOperation({ summary: 'Order detail with full tracking' })
  findOne(@Param('id') id: string) {
    return this.ordersService.adminFindById(id);
  }

  @Patch(':id/advance')
  @UseGuards(PermissionsGuard)
  @RequirePermission('orders:update-status')
  @ApiOperation({ summary: 'Advance order to next tracking stage' })
  advance(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.ordersService.advanceOrderStatus(id, dto, adminId, ctx),
    );
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Cancel order (administrator only)' })
  cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.ordersService.cancelOrder(id, adminId, ctx),
    );
  }
}
