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
import { CreateBuyerProfileDto } from './dto/create-buyer-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import type { Request } from 'express';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../modules/auth/guards/permissions.guard';
import { RequirePermission } from '../modules/auth/decorators/permissions.decorator';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { Roles } from '../modules/auth/decorators/roles.decorator';

class UpdateBuyerProfileDto extends PartialType(CreateBuyerProfileDto) {}

@ApiTags('users')
@ApiBearerAuth('JWT-access')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('buyer-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create buyer profile' })
  @ApiOkResponse({ description: 'Created buyer profile' })
  createBuyerProfile(
    @Req() request: Request,
    @Body() dto: CreateBuyerProfileDto,
  ) {
    const user = request.user as { sub: string } | undefined;
    if (!user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.createBuyerProfile(user.sub, dto);
  }

  @Get('buyer-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get own buyer profile' })
  @ApiOkResponse({ description: 'Buyer profile' })
  getBuyerProfile(@Req() request: Request) {
    const user = request.user as { sub: string } | undefined;
    if (!user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.getBuyerProfile(user.sub);
  }

  @Patch('buyer-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update buyer profile' })
  @ApiOkResponse({ description: 'Updated buyer profile' })
  updateBuyerProfile(
    @Req() request: Request,
    @Body() dto: UpdateBuyerProfileDto,
  ) {
    const user = request.user as { sub: string } | undefined;
    if (!user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.updateBuyerProfile(user.sub, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ description: 'All users' })
  listAllUsers() {
    return this.usersService.findAll();
  }

  @Patch(':id/roles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('users:manage-roles')
  @ApiOperation({ summary: 'Assign roles to a user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { roles: { type: 'array', items: { type: 'string' } } },
    },
  })
  @ApiOkResponse({ description: 'Updated user roles' })
  updateUserRoles(@Param('id') id: string, @Body('roles') roles: string[]) {
    return this.usersService.updateUserRoles(id, roles);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiOkResponse({ description: 'Deactivated user' })
  deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }
}
