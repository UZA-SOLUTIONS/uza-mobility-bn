import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth('JWT-access')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private requireUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Get('my')
  @UseGuards(PermissionsGuard)
  @RequirePermission('orders:read')
  @ApiOperation({ summary: 'List my orders with tracking events' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FilterOrdersDto,
  ) {
    return this.ordersService.findMine(this.requireUserId(request), filters);
  }

  @Get(':id/tracking')
  @UseGuards(PermissionsGuard)
  @RequirePermission('orders:read')
  @ApiOperation({ summary: 'Order tracking timeline' })
  tracking(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.ordersService.findTrackingForUser(
      this.requireUserId(request),
      id,
    );
  }
}
