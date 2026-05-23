import {
  Body,
  Controller,
  Get,
  Headers,
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
} from '@nestjs/swagger';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import { Public } from './decorators/public.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/users.service';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { extractBearerToken } from './utils/extract-bearer-token.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import type { Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, getRequestAuditContext(request));
  }

  @Post('login')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, getRequestAuditContext(request));
  }

  @Post('refresh')
  @Public()
  @ApiBearerAuth('JWT-refresh')
  @ApiOperation({
    summary: 'Refresh access token (use refresh token in Authorization header)',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(
    @Headers('authorization') authHeader: string,
  ): Promise<AuthResponseDto> {
    const token = extractBearerToken(authHeader, 'refresh token');
    return this.authService.refresh(token);
  }

  @Post('logout')
  @Public()
  @SkipAudit()
  @ApiBearerAuth('JWT-refresh')
  @ApiOperation({ summary: 'Logout by invalidating the refresh token' })
  @ApiOkResponse({ description: 'Refresh token invalidated' })
  async logout(
    @Headers('authorization') authHeader: string,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    const token = extractBearerToken(authHeader, 'refresh token');
    await this.authService.logout(token, getRequestAuditContext(request));
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @ApiBearerAuth('JWT-access')
  @ApiOperation({
    summary: 'Get current session profile',
    description:
      'Returns user fields, roles, effective permissions (from DB), buyerProfile, and seller.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  async me(@Req() request: AuthenticatedRequest): Promise<MeResponseDto> {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.authService.me(request.user.sub);
  }

  @Patch('me')
  @SkipAudit()
  @ApiBearerAuth('JWT-access')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiOkResponse({ description: 'Updated user profile' })
  async updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateUserDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.updateMe(
      request.user.sub,
      dto,
      getRequestAuditContext(request),
    );
  }
}
