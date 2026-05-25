import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SellerType } from '@prisma/client';
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
  getSellerProfile(
    @Req() request: AuthenticatedRequest,
    @Query('sellerType') sellerType?: SellerType,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.getSellerProfile(request.user.sub, sellerType);
  }

  @Get('seller-profiles')
  @ApiOperation({ summary: 'List all seller profiles for current user' })
  @ApiOkResponse({ description: 'Seller profiles' })
  listSellerProfiles(@Req() request: AuthenticatedRequest) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.listSellerProfiles(request.user.sub);
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
  @ApiOperation({
    summary: 'Update seller profile',
    description:
      'Text fields only. User profile photo is updated via PATCH /auth/me.',
  })
  @ApiOkResponse({ description: 'Updated seller profile' })
  updateSellerProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateSellerProfileDto,
    @Query('sellerType') sellerType?: SellerType,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.updateSellerProfile(
      request.user.sub,
      {
        ...dto,
        ...(sellerType ? { sellerType } : {}),
      },
      getRequestAuditContext(request),
    );
  }
}
