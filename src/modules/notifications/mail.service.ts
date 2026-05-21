import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import * as nodemailer from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
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

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }

  buildNotificationEmailHtml(params: {
    appName: string;
    title: string;
    body: string;
    frontendUrl?: string;
  }): string {
    const linkBlock = params.frontendUrl
      ? `<p><a href="${params.frontendUrl}">Open ${params.appName}</a></p>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2 style="margin-bottom: 8px;">${params.title}</h2>
        <p>${params.body}</p>
        ${linkBlock}
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #666;">You received this email from ${params.appName}.</p>
      </div>
    `.trim();
  }
}
