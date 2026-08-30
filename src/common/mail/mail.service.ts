import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import * as nodemailer from 'nodemailer';
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
  /*
   * Attachments are passed by CONTENT, never by path.
   *
   * There used to be a `fileAttachments` option taking `{ filename, path }`, which
   * nodemailer reads straight off the local filesystem. Nothing in the codebase
   * called it, so it was a dormant file-read primitive: the day somebody wired it to
   * a request field, an attacker could name any path the API process can read and
   * have it emailed out.
   *
   * A caller that needs to attach a file reads it deliberately and passes the buffer,
   * which puts the decision about WHICH file at the call site where it can be
   * reviewed. It also closes the exposure in advisory GHSA nodemailer "raw option
   * bypasses disableFileAccess", independently of the installed version.
   */
  bufferAttachments?: Array<{ filename: string; content: Buffer }>;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private enabled = false;
  private fromAddress = 'noreply@uza.local';

  constructor(private readonly configService: ConfigService) {}

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

    const attachments = (input.bufferAttachments ?? []).map((file) => ({
      filename: file.filename,
      content: file.content,
    }));

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
    const paragraphs = params.body
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p style="margin: 0 0 12px">${escapeHtml(part)}</p>`)
      .join('');

    return buildBrandedEmailHtml({
      ...brand,
      logoUrl: '',
      headline: params.title,
      bodyHtml:
        paragraphs ||
        `<p style="margin: 0 0 12px">You have a new update on ${escapeHtml(params.appName)}.</p>`,
      actionUrl: params.frontendUrl,
      actionLabel: params.actionLabel ?? 'View your account',
      footerReason: `You are receiving this email because you have an account or activity on ${params.appName}.`,
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
      logoUrl: '',
      recipientName: params.firstName,
      headline: 'Verify your email',
      bodyHtml: `
        <p style="margin: 0 0 12px">
          Thank you for joining ${escapeHtml(params.appName)}. Please confirm your
          email address to activate your account.
        </p>
        <p style="margin: 0 0 12px">
          This link expires in 24 hours. If you did not create an account, you
          can ignore this email.
        </p>`,
      actionUrl: params.verifyUrl,
      actionLabel: 'Verify your email',
      footerReason: `You are receiving this email because you created an account on ${params.appName}. If you did not sign up, you can ignore this message.`,
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
      logoUrl: '',
      recipientName: params.firstName,
      headline: 'Reset your password',
      bodyHtml: `
        <p style="margin: 0 0 12px">
          We received a request to reset the password for your
          ${escapeHtml(params.appName)} account.
        </p>
        <p style="margin: 0 0 12px">
          Use the link below to choose a new password. It expires in 1 hour. If
          you did not request a reset, ignore this email and your password will
          stay the same.
        </p>`,
      actionUrl: params.resetUrl,
      actionLabel: 'Reset your password',
      footerReason: `You are receiving this email because a password reset was requested for your ${params.appName} account. If you did not request this, you can ignore this message.`,
    });
  }

  private getEmailBrandDefaults(
    appName: string,
  ): Pick<
    BrandedEmailParams,
    | 'appName'
    | 'tagline'
    | 'logoUrl'
    | 'websiteUrl'
    | 'supportUrl'
    | 'companyLegalName'
    | 'companyLocation'
  > {
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    const tagline =
      this.configService.get<string>('MAIL_TAGLINE') ??
      'Electric vehicle marketplace and mobility platform for Rwanda.';

    const supportUrl =
      this.configService.get<string>('MAIL_SUPPORT_URL') ??
      `${frontendUrl}/about`;

    const companyLegalName =
      this.configService.get<string>('MAIL_COMPANY_LEGAL_NAME') ??
      'UZA Solutions Ltd';

    const companyLocation =
      this.configService.get<string>('MAIL_COMPANY_LOCATION') ??
      'Kigali, Rwanda';

    return {
      appName,
      tagline,
      logoUrl: '',
      websiteUrl: frontendUrl,
      supportUrl,
      companyLegalName,
      companyLocation,
    };
  }
}
