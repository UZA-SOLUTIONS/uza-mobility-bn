import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipAudit } from '../common/audit/decorators/skip-audit.decorator';
import { getRequestAuditContext } from '../common/audit/request-context.util';
import { RequirePermission } from '../modules/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../modules/auth/guards/permissions.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { Roles } from '../modules/auth/decorators/roles.decorator';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { UsersService } from './users.service';
import type { AuthenticatedRequest } from './users.types';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/users')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @ApiOperation({ summary: 'List all users (super admin)' })
  @ApiOkResponse({ description: 'All users' })
  listAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/roles')
  @SkipAudit()
  @UseGuards(PermissionsGuard)
  @RequirePermission('users:manage-roles')
  @ApiOperation({ summary: 'Assign roles to a user' })
  @ApiOkResponse({ description: 'Updated user roles' })
  updateRoles(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignUserRolesDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.usersService.updateUserRoles(id, dto.roles, adminId, ctx),
    );
  }

  @Patch(':id/deactivate')
  @SkipAudit()
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiOkResponse({ description: 'Deactivated user' })
  deactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.usersService.deactivateUser(id, adminId, ctx),
    );
  }

  @Patch(':id/activate')
  @SkipAudit()
  @UseGuards(PermissionsGuard)
  @RequirePermission('users:manage-roles')
  @ApiOperation({ summary: 'Reactivate a deactivated user' })
  @ApiOkResponse({ description: 'Reactivated user' })
  activate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.usersService.activateUser(id, adminId, ctx),
    );
  }
}
