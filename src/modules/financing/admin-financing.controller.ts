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
import { AssignBankDto } from './dto/assign-bank.dto';
import { FilterFinancingDto } from './dto/filter-financing.dto';
import { RecordFinancingOutcomeDto } from './dto/record-financing-outcome.dto';
import { FinancingService } from './financing.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/financing')
@UseGuards(RolesGuard)
@Roles('FINANCE_ADMIN', 'SUPER_ADMIN')
export class AdminFinancingController {
  constructor(private readonly financingService: FinancingService) {}

  private adminContext(request: AuthenticatedRequest) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return { userId, context: getRequestAuditContext(request) };
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('financing:read')
  @ApiOperation({ summary: 'List financing requests' })
  findAll(@Query() filters: FilterFinancingDto) {
    return this.financingService.findAllAdmin(filters);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('financing:read')
  @ApiOperation({ summary: 'Financing request detail' })
  findOne(@Param('id') id: string) {
    return this.financingService.findByIdAdmin(id);
  }

  @Patch(':id/assign-bank')
  @UseGuards(PermissionsGuard)
  @RequirePermission('financing:send-to-bank')
  @ApiOperation({ summary: 'Assign bank partner and mark sent to bank' })
  assignBank(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignBankDto,
  ) {
    const { userId, context } = this.adminContext(request);
    return this.financingService.assignBank(id, dto, userId, context);
  }

  @Patch(':id/outcome')
  @UseGuards(PermissionsGuard)
  @RequirePermission('financing:send-to-bank')
  @ApiOperation({ summary: 'Record bank approval or rejection' })
  outcome(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RecordFinancingOutcomeDto,
  ) {
    const { userId, context } = this.adminContext(request);
    return this.financingService.recordOutcome(id, dto, userId, context);
  }
}
