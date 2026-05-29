import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/dashboard')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @SkipAudit()
  @ApiOperation({ summary: 'Administrator dashboard overview metrics' })
  overview() {
    return this.dashboardService.getOverview();
  }
}
