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
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChargingStationsService } from './charging-stations.service';
import { FilterStationsDto } from './dto/filter-stations.dto';
import { StationReviewActionDto } from './dto/station-review-action.dto';

@ApiTags('admin/charging-stations')
@ApiBearerAuth('JWT-access')
@Controller('admin/charging-stations')
@UseGuards(RolesGuard)
@Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
export class AdminStationsController {
  constructor(private readonly stationsService: ChargingStationsService) {}

  private requireAdminId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Get('operators')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:read-all')
  @ApiOperation({ summary: 'List operator applications' })
  listOperators(@Query() filters: FilterStationsDto) {
    return this.stationsService.adminListOperators(filters);
  }

  @Patch('operators/:id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:approve')
  @ApiOperation({ summary: 'Approve charging operator application' })
  approveOperator(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.stationsService.adminApproveOperator(
      id,
      this.requireAdminId(request),
      getRequestAuditContext(request),
    );
  }

  @Patch('operators/:id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:reject')
  @ApiOperation({ summary: 'Reject charging operator application' })
  rejectOperator(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: StationReviewActionDto,
  ) {
    return this.stationsService.adminRejectOperator(
      id,
      this.requireAdminId(request),
      dto,
      getRequestAuditContext(request),
    );
  }

  @Get('stations')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:read-all')
  @ApiOperation({ summary: 'List charging stations for moderation' })
  listStations(@Query() filters: FilterStationsDto) {
    return this.stationsService.adminListStations(filters);
  }

  @Patch('stations/:id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:approve')
  @ApiOperation({ summary: 'Approve station and publish as active' })
  approveStation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.stationsService.adminApproveStation(
      id,
      this.requireAdminId(request),
      getRequestAuditContext(request),
    );
  }

  @Patch('stations/:id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:reject')
  @ApiOperation({ summary: 'Reject station' })
  rejectStation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: StationReviewActionDto,
  ) {
    return this.stationsService.adminRejectStation(
      id,
      this.requireAdminId(request),
      dto,
      getRequestAuditContext(request),
    );
  }

  @Patch('stations/:id/suspend')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:suspend')
  @ApiOperation({ summary: 'Suspend active station' })
  suspendStation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: StationReviewActionDto,
  ) {
    return this.stationsService.adminSuspendStation(
      id,
      this.requireAdminId(request),
      dto,
      getRequestAuditContext(request),
    );
  }
}
