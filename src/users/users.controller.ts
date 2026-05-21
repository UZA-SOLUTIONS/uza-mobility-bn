import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  PartialType,
} from '@nestjs/swagger';
import { SkipAudit } from '../common/audit/decorators/skip-audit.decorator';
import { getRequestAuditContext } from '../common/audit/request-context.util';
import { CreateBuyerProfileDto } from './dto/create-buyer-profile.dto';
import { CreateSellerProfileDto } from './dto/create-seller-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { PermissionsGuard } from '../modules/auth/guards/permissions.guard';
import { RequirePermission } from '../modules/auth/decorators/permissions.decorator';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { Roles } from '../modules/auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from './users.types';

class UpdateBuyerProfileDto extends PartialType(CreateBuyerProfileDto) {}
class UpdateSellerProfileDto extends PartialType(CreateSellerProfileDto) {}

@ApiTags('users')
@ApiBearerAuth('JWT-access')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('buyer-profile')
  @SkipAudit()
  @ApiOperation({ summary: 'Create buyer profile' })
  @ApiOkResponse({ description: 'Created buyer profile' })
  createBuyerProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBuyerProfileDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.createBuyerProfile(
      request.user.sub,
      dto,
      getRequestAuditContext(request),
    );
  }

  @Get('buyer-profile')
  @ApiOperation({ summary: 'Get own buyer profile' })
  @ApiOkResponse({ description: 'Buyer profile' })
  getBuyerProfile(@Req() request: AuthenticatedRequest) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.getBuyerProfile(request.user.sub);
  }

  @Patch('buyer-profile')
  @SkipAudit()
  @ApiOperation({ summary: 'Update buyer profile' })
  @ApiOkResponse({ description: 'Updated buyer profile' })
  updateBuyerProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateBuyerProfileDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.updateBuyerProfile(
      request.user.sub,
      dto,
      getRequestAuditContext(request),
    );
  }

  @Get('seller-profile')
  @ApiOperation({ summary: 'Get own seller profile' })
  @ApiOkResponse({ description: 'Seller profile' })
  getSellerProfile(@Req() request: AuthenticatedRequest) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.getSellerProfile(request.user.sub);
  }

  @Post('seller-profile')
  @SkipAudit()
  @ApiOperation({ summary: 'Create seller profile' })
  @ApiOkResponse({ description: 'Created seller profile' })
  createSellerProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSellerProfileDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.createSellerProfile(
      request.user.sub,
      dto,
      getRequestAuditContext(request),
    );
  }

  @Patch('seller-profile')
  @SkipAudit()
  @ApiOperation({ summary: 'Update seller profile' })
  @ApiOkResponse({ description: 'Updated seller profile' })
  updateSellerProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateSellerProfileDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.updateSellerProfile(
      request.user.sub,
      dto,
      getRequestAuditContext(request),
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ description: 'All users' })
  listAllUsers() {
    return this.usersService.findAll();
  }

  @Patch(':id/roles')
  @SkipAudit()
  @UseGuards(PermissionsGuard)
  @RequirePermission('users:manage-roles')
  @ApiOperation({ summary: 'Assign roles to a user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { roles: { type: 'array', items: { type: 'string' } } },
    },
  })
  @ApiOkResponse({ description: 'Updated user roles' })
  updateUserRoles(
    @Param('id') id: string,
    @Body('roles') roles: string[],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.updateUserRoles(
      id,
      roles,
      request.user?.sub,
      getRequestAuditContext(request),
    );
  }

  @Patch(':id/deactivate')
  @SkipAudit()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiOkResponse({ description: 'Deactivated user' })
  deactivateUser(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.deactivateUser(
      id,
      request.user?.sub,
      getRequestAuditContext(request),
    );
  }
}
