import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FilterPartsDto } from './dto/filter-parts.dto';
import { PartsService } from './parts.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/parts')
@UseGuards(RolesGuard)
@Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
export class AdminPartsController {
  constructor(private readonly partsService: PartsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'List all parts' })
  findAll(@Query() filters: FilterPartsDto) {
    return this.partsService.adminFindAll(filters);
  }

  @Patch(':id/activate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'Activate part listing' })
  activate(@Param('id') id: string) {
    return this.partsService.adminSetActive(id, true);
  }

  @Patch(':id/deactivate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'Deactivate part listing' })
  deactivate(@Param('id') id: string) {
    return this.partsService.adminSetActive(id, false);
  }
}
