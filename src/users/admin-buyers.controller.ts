import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../modules/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../modules/auth/guards/permissions.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { Roles } from '../modules/auth/decorators/roles.decorator';
import { AdminFilterBuyersDto } from './dto/admin-filter-buyers.dto';
import { UsersService } from './users.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/buyers')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles('FLEET_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')
export class AdminBuyersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('invoices:read')
  @ApiOperation({
    summary: 'List buyer accounts for fleet invoicing and admin pickers',
  })
  list(@Query() filters: AdminFilterBuyersDto) {
    return this.usersService.listBuyersForAdmin(filters);
  }
}
