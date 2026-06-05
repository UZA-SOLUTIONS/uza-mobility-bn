import { Injectable, Logger } from '@nestjs/common';
import type { Invoice } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly storageDir = join(process.cwd(), 'storage', 'invoices');

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  async generate(invoiceId: string): Promise<string | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return null;
    }

    const html = await this.renderHtml(invoice);

    await mkdir(this.storageDir, { recursive: true });
    const fileName = `${invoice.invoiceNumber.replace(/\//g, '-')}.html`;
    const filePath = join(this.storageDir, fileName);
    await writeFile(filePath, html, 'utf8');

    const documentPath = `/invoices/${invoiceId}/document`;
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: documentPath },
    });

    this.logger.log(`Invoice document saved: ${filePath}`);
    return documentPath;
  }

  async readHtml(invoiceId: string): Promise<string | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return null;
    }

    const fileName = `${invoice.invoiceNumber.replace(/\//g, '-')}.html`;
    const filePath = join(this.storageDir, fileName);

    try {
      const { readFile } = await import('fs/promises');
      return readFile(filePath, 'utf8');
    } catch {
      return this.renderHtml(invoice);
    }
  }

  private async renderHtml(invoice: Invoice): Promise<string> {
    const company =
      await this.platformSettingsService.getCompanyPaymentDetails();
    const companyName = invoice.beneficiaryName ?? company.legalName;
    const bankName = invoice.bankName ?? company.bankName;
    const accountNumber = invoice.accountNumber ?? company.accountNumber;

    const formatMoney = (value: number | null | undefined, currency: string) =>
      value == null ? '—' : `${currency} ${value.toLocaleString('en-US')}`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${invoice.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 40px; }
    h1 { color: #0b5; margin-bottom: 4px; }
    .muted { color: #666; font-size: 14px; }
    .box { border: 1px solid #ddd; padding: 16px; margin: 16px 0; border-radius: 8px; }
    .highlight { background: #f4fdf8; border-color: #0b5; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    td { padding: 8px 0; vertical-align: top; }
    .label { color: #666; width: 180px; }
  </style>
</head>
<body>
  <h1>UZA Mobility</h1>
  <p class="muted">${companyName} · Proforma Invoice</p>

  <div class="box highlight">
    <strong>Payment reference:</strong> ${invoice.paymentReference}<br />
    <span class="muted">Use this reference when transferring funds.</span>
  </div>

  <div class="box">
    <table>
      <tr><td class="label">Invoice number</td><td>${invoice.invoiceNumber}</td></tr>
      <tr><td class="label">Buyer</td><td>${invoice.buyerName}</td></tr>
      <tr><td class="label">Vehicle</td><td>${[invoice.vehicleBrand, invoice.vehicleModel, invoice.vehicleYear].filter(Boolean).join(' ') || '—'}</td></tr>
      <tr><td class="label">Amount due</td><td><strong>${formatMoney(invoice.totalAmountUsd, invoice.currency)}</strong></td></tr>
      <tr><td class="label">Valid until</td><td>${invoice.validUntil ? new Date(invoice.validUntil).toLocaleDateString('en-US') : '—'}</td></tr>
    </table>
  </div>

  <div class="box">
    <strong>Bank transfer details</strong>
    <table>
      <tr><td class="label">Beneficiary</td><td>${companyName}</td></tr>
      <tr><td class="label">Bank</td><td>${bankName}</td></tr>
      <tr><td class="label">Account number</td><td>${accountNumber}</td></tr>
    </table>
  </div>

  ${invoice.notes ? `<p class="muted">Notes: ${invoice.notes}</p>` : ''}
</body>
</html>`;
  }
}
