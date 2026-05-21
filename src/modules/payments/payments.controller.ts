import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../users/users.types';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { FilterPaymentsDto } from './dto/filter-payments.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth('JWT-access')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  private requireUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Post('submit')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payments:submit')
  @ApiOperation({ summary: 'Submit payment proof for an invoice' })
  submit(@Req() request: AuthenticatedRequest, @Body() dto: SubmitPaymentDto) {
    return this.paymentsService.submitPayment(
      this.requireUserId(request),
      dto,
      getRequestAuditContext(request),
    );
  }

  @Get('my')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payments:submit')
  @ApiOperation({ summary: 'My payment submissions' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FilterPaymentsDto,
  ) {
    return this.paymentsService.findMine(this.requireUserId(request), filters);
  }
}
