import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import { StorageService } from '../../common/uploads/storage.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
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
    private readonly storage: StorageService,
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
  @UseInterceptors(FileInterceptor('photo', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema(
      {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Profile photo',
        },
      },
      [],
    ),
  })
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiOkResponse({ type: MeResponseDto })
  async updateMe(
    @Req() request: AuthenticatedRequest,
    @Body('payload') payload: string | undefined,
    @UploadedFile() photo?: Express.Multer.File,
  ): Promise<MeResponseDto> {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Unauthenticated');
    }

    const dto = payload?.trim()
      ? await parseMultipartPayload(UpdateUserDto, payload)
      : {};

    let previousPhoto: string | null | undefined;
    if (photo) {
      const current = await this.authService.me(request.user.sub);
      previousPhoto = current.profilePhoto;
    }

    const profilePhoto = photo
      ? (await this.storage.uploadImage(photo, UploadFolder.PROFILES)).url
      : undefined;

    await this.usersService.updateMe(
      request.user.sub,
      {
        ...dto,
        ...(profilePhoto ? { profilePhoto } : {}),
      },
      getRequestAuditContext(request),
    );

    if (profilePhoto && previousPhoto) {
      await this.storage.deleteByUrl(previousPhoto);
    }

    return this.authService.me(request.user.sub);
  }
}
