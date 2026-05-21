import {
  Body,
  Controller,
  Delete,
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
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreatePartDto } from './dto/create-part.dto';
import { FilterPartsDto } from './dto/filter-parts.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { PartsService } from './parts.service';

@ApiTags('parts')
@Controller('parts')
export class PartsController {
  constructor(private readonly partsService: PartsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Browse parts (includes out-of-stock listings)' })
  browse(@Query() filters: FilterPartsDto) {
    return this.partsService.browse(filters);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Part detail' })
  findOne(@Param('id') id: string) {
    return this.partsService.findById(id);
  }

  @Post()
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:create')
  @ApiOperation({ summary: 'List a new part (seller)' })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreatePartDto) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.partsService.createForSeller(userId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:create')
  @ApiOperation({ summary: 'Update own part' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePartDto,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.partsService.updateOwn(userId, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('parts:create')
  @ApiOperation({ summary: 'Deactivate own part listing' })
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    await this.partsService.deleteOwn(userId, id);
    return { deleted: true };
  }
}
