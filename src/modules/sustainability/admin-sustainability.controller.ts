import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FilterImpactDto } from './dto/filter-impact.dto';
import { SustainabilityService } from './sustainability.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/sustainability')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles('SUSTAINABILITY_ADMIN', 'SUPER_ADMIN')
@RequirePermission('sustainability:read')
export class AdminSustainabilityController {
  constructor(private readonly sustainabilityService: SustainabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Sustainability dashboard overview' })
  overview(@Query() filters: FilterImpactDto) {
    return this.sustainabilityService.getAdminOverview(filters);
  }

  @Get('by-buyer-type')
  @ApiOperation({ summary: 'Impact breakdown by buyer type' })
  byBuyerType(@Query() filters: FilterImpactDto) {
    return this.sustainabilityService.breakdownByBuyerType(filters);
  }

  @Get('by-country')
  @ApiOperation({ summary: 'Impact breakdown by country' })
  byCountry(@Query() filters: FilterImpactDto) {
    return this.sustainabilityService.breakdownByCountry(filters);
  }

  @Get('by-vehicle-type')
  @ApiOperation({ summary: 'Impact breakdown by vehicle category' })
  byVehicleType(@Query() filters: FilterImpactDto) {
    return this.sustainabilityService.breakdownByVehicleType(filters);
  }

  @Get('fleet/:clientName')
  @ApiOperation({ summary: 'Impact report for a fleet client name' })
  fleetClient(
    @Param('clientName') clientName: string,
    @Query() filters: FilterImpactDto,
  ) {
    return this.sustainabilityService.reportByFleetClient(clientName, filters);
  }
}
