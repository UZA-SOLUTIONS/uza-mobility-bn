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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AddAssociationMemberDto } from './dto/add-association-member.dto';
import { CreateAssociationDto } from './dto/create-association.dto';
import { FilterFleetRequestsDto } from './dto/filter-fleet.dto';
import { UpdateFleetRequestStatusDto } from './dto/update-fleet-request.dto';
import { FleetService } from './fleet.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/fleet')
@UseGuards(RolesGuard)
@Roles('FLEET_ADMIN', 'SUPER_ADMIN')
export class AdminFleetController {
  constructor(private readonly fleetService: FleetService) {}

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

  @Get('associations')
  @UseGuards(PermissionsGuard)
  @RequirePermission('fleet:read')
  @ApiOperation({ summary: 'List associations' })
  listAssociations() {
    return this.fleetService.listAssociations();
  }

  @Post('associations')
  @UseGuards(PermissionsGuard)
  @RequirePermission('fleet:update-status')
  @ApiOperation({ summary: 'Create association' })
  createAssociation(@Body() dto: CreateAssociationDto) {
    return this.fleetService.createAssociation(dto);
  }

  @Post('associations/:id/members')
  @UseGuards(PermissionsGuard)
  @RequirePermission('fleet:update-status')
  @ApiOperation({ summary: 'Add member to association' })
  addMember(@Param('id') id: string, @Body() dto: AddAssociationMemberDto) {
    return this.fleetService.addAssociationMember(id, dto);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('fleet:read')
  @ApiOperation({ summary: 'List all fleet requests' })
  findAll(@Query() filters: FilterFleetRequestsDto) {
    return this.fleetService.adminFindAll(filters);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('fleet:read')
  @ApiOperation({ summary: 'Fleet request detail' })
  findOne(@Param('id') id: string) {
    return this.fleetService.adminFindById(id);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermission('fleet:update-status')
  @ApiOperation({ summary: 'Update fleet request status' })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateFleetRequestStatusDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.fleetService.updateStatus(id, dto, adminId, ctx),
    );
  }
}
