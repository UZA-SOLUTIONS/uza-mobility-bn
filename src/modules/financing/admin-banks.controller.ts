import {
  Body,
  Controller,
  Get,
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
import { CreateBankDto } from './dto/create-bank.dto';
import { FinancingService } from './financing.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/banks')
@UseGuards(RolesGuard)
export class AdminBanksController {
  constructor(private readonly financingService: FinancingService) {}

  @Get()
  @Roles('FINANCE_ADMIN', 'SUPER_ADMIN')
  @UseGuards(PermissionsGuard)
  @RequirePermission('financing:read')
  @ApiOperation({ summary: 'List active bank partners' })
  list() {
    return this.financingService.listBanks();
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Add bank partner' })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateBankDto) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException();

    return this.financingService.createBank(
      dto,
      userId,
      getRequestAuditContext(request),
    );
  }
}
