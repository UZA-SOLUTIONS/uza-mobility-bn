import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { generateRawToken, hashToken } from './auth-token.util';

const GOOGLE_OAUTH_STATE_PURPOSE = 'google_oauth_state';
const EXCHANGE_TTL_MS = 5 * 60 * 1000;

export type GoogleProfileFromOAuth = {
  email: string;
  googleId: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
};

type GoogleOAuthStatePayload = {
  purpose: typeof GOOGLE_OAUTH_STATE_PURPOSE;
  returnTo: string;
};

type PendingGoogleExchange = {
  profile: GoogleProfileFromOAuth;
  expiresAt: number;
};

@Injectable()
export class GoogleOAuthService {
  private readonly pendingExchanges = new Map<string, PendingGoogleExchange>();

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.getClientId() &&
      this.getClientSecret() &&
      this.getRedirectUri() &&
      this.getFrontendUrl(),
    );
  }

  getAuthorizationUrl(returnTo?: string): string {
    const client = this.getOAuthClient();
    const safeReturnTo = this.sanitizeReturnTo(returnTo);
    const state = this.jwtService.sign(
      {
        purpose: GOOGLE_OAUTH_STATE_PURPOSE,
        returnTo: safeReturnTo,
      } satisfies GoogleOAuthStatePayload,
      { expiresIn: '10m' },
    );

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      state,
      redirect_uri: this.getRedirectUri(),
    });
  }

  async exchangeAuthorizationCode(
    code: string,
    state: string,
  ): Promise<{ exchangeCode: string; returnTo: string }> {
    const returnTo = this.parseStateReturnTo(state);
    const client = this.getOAuthClient();

    let idToken: string | null | undefined;

    try {
      const response = await client.getToken({
        code,
        redirect_uri: this.getRedirectUri(),
      });
      idToken = response.tokens.id_token;
    } catch {
      throw new UnauthorizedException(
        'Failed to exchange Google authorization code',
      );
    }

    if (!idToken) {
      throw new UnauthorizedException('Google did not return an ID token');
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: this.getClientId(),
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google account email is required');
    }

    const profile: GoogleProfileFromOAuth = {
      email: payload.email.trim().toLowerCase(),
      googleId: payload.sub,
      firstName:
        payload.given_name?.trim() ||
        payload.name?.trim().split(/\s+/)[0] ||
        'Buyer',
      lastName:
        payload.family_name?.trim() ||
        payload.name?.trim().split(/\s+/).slice(1).join(' ') ||
        'User',
      emailVerified: payload.email_verified ?? true,
    };

    return {
      exchangeCode: this.storePendingExchange(profile),
      returnTo,
    };
  }

  consumePendingExchange(exchangeCode: string): GoogleProfileFromOAuth {
    const hashed = hashToken(exchangeCode);
    const pending = this.pendingExchanges.get(hashed);

    if (!pending || pending.expiresAt < Date.now()) {
      this.pendingExchanges.delete(hashed);
      throw new UnauthorizedException(
        'Google sign-in session expired or invalid',
      );
    }

    this.pendingExchanges.delete(hashed);
    return pending.profile;
  }

  buildFrontendCallbackUrl(exchangeCode: string, returnTo: string): string {
    const url = new URL('/auth/google/callback', this.getFrontendUrl());
    url.searchParams.set('code', exchangeCode);
    if (returnTo) {
      url.searchParams.set('returnTo', returnTo);
    }
    return url.toString();
  }

  buildFrontendErrorUrl(message: string, returnTo?: string): string {
    const url = new URL('/auth/google/callback', this.getFrontendUrl());
    url.searchParams.set('error', message);
    if (returnTo) {
      url.searchParams.set('returnTo', returnTo);
    }
    return url.toString();
  }

  private storePendingExchange(profile: GoogleProfileFromOAuth): string {
    const exchangeCode = generateRawToken();
    this.pendingExchanges.set(hashToken(exchangeCode), {
      profile,
      expiresAt: Date.now() + EXCHANGE_TTL_MS,
    });
    return exchangeCode;
  }

  private parseStateReturnTo(state: string): string {
    try {
      const payload = this.jwtService.verify<GoogleOAuthStatePayload>(state);
      if (payload.purpose !== GOOGLE_OAUTH_STATE_PURPOSE) {
        throw new Error('Invalid OAuth state');
      }
      return this.sanitizeReturnTo(payload.returnTo);
    } catch {
      throw new BadRequestException('Invalid or expired Google OAuth state');
    }
  }

  private sanitizeReturnTo(returnTo?: string): string {
    const value = returnTo?.trim();
    if (!value || !value.startsWith('/')) {
      return '/vehicles';
    }
    return value;
  }

  private getOAuthClient(): OAuth2Client {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google sign-in is not configured');
    }

    return new OAuth2Client(
      this.getClientId(),
      this.getClientSecret(),
      this.getRedirectUri(),
    );
  }

  private getClientId(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim() ?? '';
  }

  private getClientSecret(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_SECRET')?.trim() ?? '';
  }

  private getRedirectUri(): string {
    return (
      this.configService.get<string>('GOOGLE_REDIRECT_URI')?.trim() ?? ''
    ).replace(/\/$/, '');
  }

  private getFrontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL')?.trim() ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }
}
