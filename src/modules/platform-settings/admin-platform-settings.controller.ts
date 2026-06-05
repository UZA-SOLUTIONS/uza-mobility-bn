import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/platform-settings')
export class AdminPlatformSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

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

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('platform-settings:manage')
  @ApiOperation({ summary: 'Get platform payment and booking defaults' })
  getSettings() {
    return this.platformSettingsService.getSettings();
  }

  @Patch()
  @UseGuards(PermissionsGuard)
  @RequirePermission('platform-settings:manage')
  @ApiOperation({ summary: 'Update platform payment and booking defaults' })
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdatePlatformSettingsDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.platformSettingsService.updateSettings(adminId, dto, ctx),
    );
  }
}
