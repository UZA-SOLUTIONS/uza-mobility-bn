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
import { FilterPaymentsDto } from './dto/filter-payments.dto';
import { MarkPartialPaymentDto } from './dto/partial-payment.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
  @RequirePermission('payments:verify')
  @ApiOperation({ summary: 'List payments for finance verification' })
  findAll(@Query() filters: FilterPaymentsDto) {
    return this.paymentsService.adminFindAll(filters);
  }

  @Patch(':id/confirm')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payments:verify')
  @ApiOperation({
    summary: 'Confirm payment — marks listing sold and creates order',
  })
  confirm(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.paymentsService.confirmPayment(id, adminId, ctx),
    );
  }

  @Patch(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payments:reject')
  @ApiOperation({
    summary: 'Reject payment — invoice returns to awaiting payment',
  })
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.paymentsService.rejectPayment(id, adminId, dto, ctx),
    );
  }

  @Patch(':id/partial')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payments:verify')
  @ApiOperation({ summary: 'Mark invoice as partially paid' })
  partial(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MarkPartialPaymentDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.paymentsService.markPartial(id, adminId, dto, ctx),
    );
  }
}
