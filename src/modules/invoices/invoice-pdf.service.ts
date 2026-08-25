import { existsSync, readFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import type { Invoice } from '@prisma/client';
import { formatInvoiceBankAccountsHtml } from '../../common/money/dual-bank-accounts.util';
import {
  formatDualMoney,
  formatMoneyRwf,
  toDisplayRwf,
} from '../../common/money/money-format.util';
import { HtmlToPdfService } from '../../common/pdf/html-to-pdf.service';
import { ExchangeRateService } from '../platform-settings/exchange-rate.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';

const EMAIL_LOGO_FILENAME = 'FInal-logo-dashboard.png';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly storageDir = join(process.cwd(), 'storage', 'invoices');

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly htmlToPdf: HtmlToPdfService,
  ) {}

  async generate(invoiceId: string): Promise<string | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return null;
    }

    const pdfBuffer = await this.renderPdfBuffer(invoice);

    await mkdir(this.storageDir, { recursive: true });
    const fileName = `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
    const filePath = join(this.storageDir, fileName);
    await writeFile(filePath, pdfBuffer);

    const documentPath = `/invoices/${invoiceId}/document`;
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: documentPath },
    });

    this.logger.log(`Invoice PDF saved: ${filePath}`);
    return documentPath;
  }

  async readPdfBuffer(invoiceId: string): Promise<Buffer | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return null;
    }

    // Always re-render so amounts and bank details stay current.
    return this.renderPdfBuffer(invoice);
  }

  private async renderPdfBuffer(invoice: Invoice): Promise<Buffer> {
    const html = await this.renderHtml(invoice);
    return this.htmlToPdf.render(html);
  }

  private async renderHtml(invoice: Invoice): Promise<string> {
    const [company, exchangeRate] = await Promise.all([
      this.platformSettingsService.getCompanyPaymentDetails(),
      this.exchangeRateService.getSnapshot({ refreshIfStale: false }),
    ]);
    const companyName = invoice.beneficiaryName ?? company.legalName;
    const usdToRwf = invoice.exchangeRateUsed ?? exchangeRate.usdToRwfEffective;
    const amountDue =
      invoice.currency === 'USD'
        ? formatDualMoney(invoice.totalAmountUsd, usdToRwf, {
            unit: 'USD',
            empty: '—',
          })
        : formatMoneyRwf(
            invoice.totalAmountRwf ??
              toDisplayRwf({
                currency: invoice.currency,
                amountRwf: invoice.totalAmountRwf,
                amountUsd: invoice.totalAmountUsd,
                frozenRate: usdToRwf,
              }),
            { empty: '—' },
          );
    const bankRows = formatInvoiceBankAccountsHtml({
      currency: invoice.currency,
      legalName: companyName,
      usdBankName: invoice.bankName ?? company.usd.bankName,
      usdAccountNumber: invoice.accountNumber ?? company.usd.accountNumber,
      rwfBankName: invoice.rwfBankName ?? company.rwf.bankName,
      rwfAccountNumber: invoice.rwfAccountNumber ?? company.rwf.accountNumber,
      escapeHtml: (value) => this.escapeHtml(value),
      asTableRows: true,
    });
    const vehicleLabel =
      [invoice.vehicleBrand, invoice.vehicleModel, invoice.vehicleYear]
        .filter(Boolean)
        .join(' ') || '—';
    const logoDataUri = this.readLogoDataUri();
    const logoHtml = logoDataUri
      ? `<img class="logo" src="${logoDataUri}" alt="${this.escapeHtml(companyName)}" />`
      : `<strong>${this.escapeHtml(companyName)}</strong>`;
    const issuedAt = invoice.issuedAt ?? invoice.createdAt;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #151515; margin: 32px; font-size: 13px; }
    h1 { color: #174438; margin: 0; font-size: 22px; }
    .muted { color: #356769; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; align-items: flex-start; }
    .logo { height: 48px; width: auto; display: block; }
    .box { border: 1px solid #e9e9e9; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .highlight { background: #e8f4fc; border-color: #cfe6f5; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    td { padding: 8px 0; vertical-align: top; }
    .label { color: #356769; width: 180px; }
    .intent-badge { display: inline-block; background: #174438; color: #fff; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; margin-bottom: 8px; text-transform: uppercase; }
    .valid { color: #c0392b; font-weight: 600; }
    .footer { margin-top: 24px; font-size: 12px; color: #356769; display: flex; justify-content: space-between; gap: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoHtml}
      <div class="muted" style="margin-top: 8px">Kigali, Rwanda</div>
      <div class="muted">info@uzamobility.com</div>
    </div>
    <div style="text-align:right">
      <div class="intent-badge">Invoice</div>
      <h1>PROFORMA INVOICE</h1>
      <div><strong>${this.escapeHtml(invoice.invoiceNumber)}</strong></div>
      <div>Issue date: ${new Date(issuedAt).toLocaleDateString('en-GB')}</div>
      ${
        invoice.validUntil
          ? `<div class="valid">Valid until: ${new Date(invoice.validUntil).toLocaleDateString('en-GB')}</div>`
          : ''
      }
    </div>
  </div>

  <div class="box highlight">
    <strong>Payment reference:</strong> ${this.escapeHtml(invoice.paymentReference)}<br />
    <span class="muted">Use this reference when transferring funds.</span>
  </div>

  <div class="box">
    <table>
      <tr><td class="label">Buyer</td><td>${this.escapeHtml(invoice.buyerName)}</td></tr>
      ${
        invoice.buyerEmail
          ? `<tr><td class="label">Email</td><td>${this.escapeHtml(invoice.buyerEmail)}</td></tr>`
          : ''
      }
      <tr><td class="label">Vehicle</td><td>${this.escapeHtml(vehicleLabel)}</td></tr>
      <tr><td class="label">Amount due</td><td><strong>${this.escapeHtml(amountDue)}</strong></td></tr>
    </table>
  </div>

  <div class="box">
    <strong>Bank transfer details</strong>
    <table>
      ${bankRows}
    </table>
  </div>

  ${
    invoice.notes
      ? `<div class="box"><strong>Notes</strong><br />${this.escapeHtml(invoice.notes)}</div>`
      : ''
  }

  <div class="footer">
    <span>${this.escapeHtml(companyName)} · Kigali, Rwanda</span>
    <span>Generated automatically — contact our team for questions.</span>
  </div>
</body>
</html>`;
  }

  private readLogoDataUri(): string | null {
    const candidates = [
      join(__dirname, '../../common/mail/assets', EMAIL_LOGO_FILENAME),
      join(process.cwd(), 'src/common/mail/assets', EMAIL_LOGO_FILENAME),
      join(process.cwd(), 'dist/common/mail/assets', EMAIL_LOGO_FILENAME),
    ];

    for (const filePath of candidates) {
      if (!existsSync(filePath)) continue;
      try {
        const buffer = readFileSync(filePath);
        return `data:image/png;base64,${buffer.toString('base64')}`;
      } catch {
        // try next path
      }
    }
    return null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
