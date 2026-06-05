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
import { BookingsService } from './bookings.service';
import { FilterBookingsDto } from './dto/filter-bookings.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { UpdateBookingFeeDto } from './dto/update-booking-fee.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

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
  @RequirePermission('bookings:verify')
  @ApiOperation({ summary: 'List vehicle bookings for verification' })
  findAll(@Query() filters: FilterBookingsDto) {
    return this.bookingsService.adminFindAll(filters);
  }

  @Patch(':id/fee')
  @UseGuards(PermissionsGuard)
  @RequirePermission('bookings:manage')
  @ApiOperation({
    summary: 'Adjust booking fee before payment proof is submitted',
  })
  updateFee(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBookingFeeDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.bookingsService.updateBookingFee(adminId, id, dto, ctx),
    );
  }

  @Patch(':id/confirm')
  @UseGuards(PermissionsGuard)
  @RequirePermission('bookings:verify')
  @ApiOperation({
    summary: 'Confirm booking payment and flag listing as booked',
  })
  confirm(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.bookingsService.confirmBooking(adminId, id, ctx),
    );
  }

  @Patch(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission('bookings:reject')
  @ApiOperation({ summary: 'Reject booking payment proof' })
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.bookingsService.rejectBooking(adminId, id, dto, ctx),
    );
  }
}
