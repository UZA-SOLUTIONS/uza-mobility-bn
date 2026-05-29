import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActivityLogsService } from './activity-logs.service';
import { FilterActivityLogsDto } from './dto/filter-activity-logs.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/activity-logs')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @SkipAudit()
  @ApiOperation({
    summary: 'List platform activity logs (administrator only)',
    description:
      'All query parameters are optional. Leave filters empty to return every log. ' +
      'Response shape: { success, data: ActivityLog[], meta: { total, page, limit, totalPages } }. ' +
      'Each log includes action, entity, ipAddress, userAgent, metadata (email, etc.) — no userId in the response.',
  })
  @ApiOkResponse({
    description: 'Paginated activity logs',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'clxyz',
            action: 'auth:login',
            entity: 'User',
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0 ...',
            metadata: { email: 'admin@uza.local' },
            occurredAt: '2026-05-21T11:13:32.000Z',
          },
        ],
        meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
      },
    },
  })
  findAll(@Query() filters: FilterActivityLogsDto) {
    return this.activityLogsService.findAll(filters);
  }
}
