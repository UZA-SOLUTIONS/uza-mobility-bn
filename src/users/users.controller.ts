import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
}
