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
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { FilterInquiriesDto } from './dto/filter-inquiries.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/inquiries')
export class AdminInquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('inquiries:read-all')
  @ApiOperation({ summary: 'List vehicle inquiries' })
  findAll(@Query() filters: FilterInquiriesDto) {
    return this.inquiriesService.adminFindAll(filters);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('inquiries:read-all')
  @ApiOperation({ summary: 'Inquiry detail' })
  findOne(@Param('id') id: string) {
    return this.inquiriesService.adminFindOne(id);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermission('inquiries:update-status')
  @ApiOperation({ summary: 'Update inquiry status and internal notes' })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateInquiryStatusDto,
  ) {
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new UnauthorizedException();
    }
    return this.inquiriesService.adminUpdateStatus(id, dto, adminId);
  }
}
