import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { documentMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { StorageService } from '../../common/uploads/storage.service';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  AssignOrderFulfillmentDto,
  UpsertShipmentDto,
} from './dto/fulfillment.dto';
import { OrdersService } from './orders.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly storage: StorageService,
  ) {}

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

  @Post('shipments')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('LOGISTICS_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('orders:update-status')
  @UseInterceptors(FileInterceptor('arrivalNotice', documentMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      arrivalNotice: { type: 'string', format: 'binary' },
    }),
  })
  @ApiOperation({ summary: 'Create shipment from MSC arrival notice fields' })
  createShipment(
    @Req() request: AuthenticatedRequest,
    @Body('payload') payload: string,
    @UploadedFile() arrivalNotice?: Express.Multer.File,
  ) {
    return this.requireAdmin(request, async (adminId, ctx) => {
      const dto = await parseMultipartPayload(UpsertShipmentDto, payload);
      const fileUrl = arrivalNotice
        ? (
            await this.storage.uploadImage(
              arrivalNotice,
              UploadFolder.LISTINGS,
              'raw',
            )
          ).url
        : undefined;
      return this.ordersService.upsertShipment(dto, fileUrl, adminId, ctx);
    });
  }

  @Patch(':id/fulfillment')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('LOGISTICS_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('orders:update-status')
  @UseInterceptors(FileInterceptor('arrivalNotice', documentMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      arrivalNotice: { type: 'string', format: 'binary' },
    }),
  })
  @ApiOperation({ summary: 'Assign VIN and shipment to an order' })
  assignFulfillment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('payload') payload: string,
    @UploadedFile() arrivalNotice?: Express.Multer.File,
  ) {
    return this.requireAdmin(request, async (adminId, ctx) => {
      const dto = await parseMultipartPayload(
        AssignOrderFulfillmentDto,
        payload,
      );
      const fileUrl = arrivalNotice
        ? (
            await this.storage.uploadImage(
              arrivalNotice,
              UploadFolder.LISTINGS,
              'raw',
            )
          ).url
        : undefined;
      return this.ordersService.assignFulfillment(
        id,
        dto,
        fileUrl,
        adminId,
        ctx,
      );
    });
  }

  @Post(':id/notify-port-arrival')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('LOGISTICS_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('orders:update-status')
  @ApiOperation({
    summary: 'Email/in-app notify buyer of port arrival',
  })
  notifyPortArrival(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.requireAdmin(request, (adminId) =>
      this.ordersService.notifyPortArrival(id, adminId),
    );
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
