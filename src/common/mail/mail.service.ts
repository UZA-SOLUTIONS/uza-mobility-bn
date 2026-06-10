import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import * as nodemailer from 'nodemailer';
import {
  EMAIL_LOGO_CID,
  EMAIL_LOGO_FILENAME,
} from './email-brand.constants';
import {
  buildBrandedEmailHtml,
  escapeHtml,
  type BrandedEmailParams,
} from './email-template.util';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Extra attachments from disk (logo CID is added automatically when available). */
  fileAttachments?: Array<{ filename: string; path: string }>;
  bufferAttachments?: Array<{ filename: string; content: Buffer }>;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private enabled = false;
  private fromAddress = 'noreply@uza.local';
  private embeddedLogoPath: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.embeddedLogoPath = this.resolveEmbeddedLogoPath();
  }

  onModuleInit(): void {
    this.enabled =
      this.configService.get<string>('MAIL_ENABLED', 'false') === 'true';
    this.fromAddress =
      this.configService.get<string>('MAIL_FROM') ??
      'UZA Mobility <noreply@uza.local>';

    if (!this.enabled) {
      this.logger.log('Email delivery disabled (MAIL_ENABLED is not true)');
      return;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host) {
      this.logger.warn(
        'MAIL_ENABLED is true but SMTP_HOST is missing — emails will be skipped',
      );
      this.enabled = false;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: pass ?? '' } : undefined,
    });

    this.logger.log(`SMTP ready (${host}:${port})`);

    if (this.embeddedLogoPath) {
      this.logger.log(`Email logo embedded from ${this.embeddedLogoPath}`);
    } else {
      this.logger.warn(
        'Bundled email logo not found — emails will use MAIL_LOGO_URL or FRONTEND_URL fallback',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.transporter !== null;
  }

  async sendMail(input: SendMailInput): Promise<void> {
    if (!this.isEnabled() || !this.transporter) {
      this.logger.debug(
        `Email skipped (disabled): subject="${input.subject}" to=${input.to}`,
      );
      return;
    }

    const attachments = [
      ...(this.embeddedLogoPath
        ? [
            {
              filename: EMAIL_LOGO_FILENAME,
              path: this.embeddedLogoPath,
              cid: EMAIL_LOGO_CID,
            },
          ]
        : []),
      ...(input.fileAttachments ?? []).map((file) => ({
        filename: file.filename,
        path: file.path,
      })),
      ...(input.bufferAttachments ?? []).map((file) => ({
        filename: file.filename,
        content: file.content,
      })),
    ];

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: attachments.length ? attachments : undefined,
    });
  }

  buildNotificationEmailHtml(params: {
    appName: string;
    title: string;
    body: string;
    frontendUrl?: string;
    actionLabel?: string;
  }): string {
    const brand = this.getEmailBrandDefaults(params.appName);

    return buildBrandedEmailHtml({
      ...brand,
      headline: params.title,
      bodyHtml: `<p style="margin: 0 0 18px">${escapeHtml(params.body)}</p>`,
      actionUrl: params.frontendUrl,
      actionLabel: params.actionLabel ?? `Open ${params.appName}`,
      infoBoxHtml:
        '<strong>Need help?</strong><br />Our support team can assist with your account, orders, and mobility services.',
    });
  }

  buildVerifyEmailHtml(params: {
    appName: string;
    firstName: string;
    verifyUrl: string;
  }): string {
    const brand = this.getEmailBrandDefaults(params.appName);

    return buildBrandedEmailHtml({
      ...brand,
      recipientName: params.firstName,
      headline: 'Verify your email',
      bodyHtml: `
        <p style="margin: 0 0 18px">
          Thank you for joining ${escapeHtml(params.appName)}. Please confirm your
          email address to activate your account and access the marketplace.
        </p>
        <p style="margin: 0 0 18px">
          This verification link expires in 24 hours. If you did not create an
          account, you can safely ignore this email.
        </p>`,
      actionUrl: params.verifyUrl,
      actionLabel: 'Verify email',
      infoBoxHtml:
        '<strong>Did not receive this email?</strong><br />Check your spam folder or sign in and request a new verification link.',
    });
  }

  buildResetPasswordHtml(params: {
    appName: string;
    firstName: string;
    resetUrl: string;
  }): string {
    const brand = this.getEmailBrandDefaults(params.appName);

    return buildBrandedEmailHtml({
      ...brand,
      recipientName: params.firstName,
      headline: 'Reset your password',
      bodyHtml: `
        <p style="margin: 0 0 18px">
          We received a request to reset the password for your ${escapeHtml(params.appName)} account.
        </p>
        <p style="margin: 0 0 18px">
          Click the button below to choose a new password. This link expires in
          1 hour. If you did not request a reset, you can ignore this email and
          your password will stay the same.
        </p>`,
      actionUrl: params.resetUrl,
      actionLabel: 'Reset password',
      infoBoxHtml:
        '<strong>Security tip</strong><br />Never share your password or this reset link with anyone.',
    });
  }

  private getEmailBrandDefaults(appName: string): Pick<
    BrandedEmailParams,
    'appName' | 'tagline' | 'logoUrl' | 'websiteUrl' | 'supportUrl'
  > {
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    const logoUrl = this.embeddedLogoPath
      ? `cid:${EMAIL_LOGO_CID}`
      : (this.configService.get<string>('MAIL_LOGO_URL') ??
        `${frontendUrl}/images/FInal-logo-dashboard.png`);

    const tagline =
      this.configService.get<string>('MAIL_TAGLINE') ??
      'Electric vehicle marketplace and mobility platform for Rwanda.';

    const supportUrl =
      this.configService.get<string>('MAIL_SUPPORT_URL') ??
      `${frontendUrl}/about`;

    return {
      appName,
      tagline,
      logoUrl,
      websiteUrl: frontendUrl,
      supportUrl,
    };
  }

  private resolveEmbeddedLogoPath(): string | null {
    const candidates = [
      join(__dirname, 'assets', EMAIL_LOGO_FILENAME),
      join(process.cwd(), 'src', 'common', 'mail', 'assets', EMAIL_LOGO_FILENAME),
      join(process.cwd(), 'dist', 'common', 'mail', 'assets', EMAIL_LOGO_FILENAME),
    ];

    return candidates.find((path) => existsSync(path)) ?? null;
  }
}
