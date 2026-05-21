import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateChargingProductDto } from './dto/create-charging-product.dto';
import { UpdateChargingProductDto } from './dto/update-charging-product.dto';
import { UpdateEnergyRequestStatusDto } from './dto/update-energy-request-status.dto';
import { EnergyService } from './energy.service';

class FilterEnergyRequestsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/energy')
export class AdminEnergyController {
  constructor(private readonly energyService: EnergyService) {}

  @Post('products')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'Create charging product' })
  createProduct(@Body() dto: CreateChargingProductDto) {
    return this.energyService.createProduct(dto);
  }

  @Patch('products/:id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('parts:manage')
  @ApiOperation({ summary: 'Update charging product' })
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateChargingProductDto,
  ) {
    return this.energyService.updateProduct(id, dto);
  }

  @Get('requests')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('FLEET_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('fleet:read')
  @ApiOperation({ summary: 'List energy quote requests' })
  listRequests(@Query() filters: FilterEnergyRequestsDto) {
    return this.energyService.adminListRequests(filters);
  }

  @Patch('requests/:id/status')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('FLEET_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('fleet:update-status')
  @ApiOperation({ summary: 'Update energy request status' })
  updateRequestStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEnergyRequestStatusDto,
  ) {
    return this.energyService.updateRequestStatus(id, dto);
  }
}
