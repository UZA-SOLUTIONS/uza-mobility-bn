import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
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

import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/users.service';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
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
  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth('JWT-refresh')
  @ApiOperation({
    summary: 'Refresh access token (use refresh token in Authorization header)',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Headers('authorization') authHeader: string,
  ): Promise<AuthResponseDto> {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    if (!token) {
      throw new Error('No refresh token provided in Authorization header');
    }

    const result = await this.authService.refresh(token);
    return result;
  }

  @Post('logout')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth('JWT-refresh')
  @ApiOperation({ summary: 'Logout by invalidating the refresh token' })
  @ApiOkResponse({ description: 'Refresh token invalidated' })
  async logout(
    @Headers('authorization') authHeader: string,
  ): Promise<{ message: string }> {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    if (!token) {
      throw new Error('No refresh token provided in Authorization header');
    }

    await this.authService.logout(token);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-access')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ description: 'Authenticated user profile' })
  async me(@Req() request: Request) {
    const user = request.user as { sub?: string } | undefined;

    if (!user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.authService.me(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-access')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiOkResponse({ description: 'Updated user profile' })
  async updateMe(@Req() request: Request, @Body() dto: UpdateUserDto) {
    const user = request.user as { sub?: string } | undefined;

    if (!user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    return this.usersService.updateMe(user.sub, dto);
  }
}
