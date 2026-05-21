import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Invoice } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly storageDir = join(process.cwd(), 'storage', 'invoices');

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generate(invoiceId: string): Promise<string | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return null;
    }

    const html = this.renderHtml(invoice);

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

  private renderHtml(invoice: Invoice): string {
    const companyName =
      this.configService.get<string>('COMPANY_LEGAL_NAME') ??
      'UZA Solutions Ltd';
    const bankName =
      invoice.bankName ??
      this.configService.get<string>('COMPANY_BANK_NAME') ??
      '—';
    const accountNumber =
      invoice.accountNumber ??
      this.configService.get<string>('COMPANY_ACCOUNT_NUMBER') ??
      '—';

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
    <table>
      <tr><td class="label">Invoice number</td><td><strong>${invoice.invoiceNumber}</strong></td></tr>
      <tr><td class="label">Payment reference</td><td><strong>${invoice.paymentReference}</strong></td></tr>
      <tr><td class="label">Status</td><td>${invoice.status}</td></tr>
      <tr><td class="label">Valid until</td><td>${invoice.validUntil?.toISOString().slice(0, 10) ?? '—'}</td></tr>
    </table>
    <p><em>Include the payment reference in your bank transfer narration.</em></p>
  </div>

  <div class="box">
    <h3>Buyer</h3>
    <table>
      <tr><td class="label">Name</td><td>${invoice.buyerName}</td></tr>
      <tr><td class="label">Email</td><td>${invoice.buyerEmail ?? '—'}</td></tr>
      <tr><td class="label">Phone</td><td>${invoice.buyerPhone ?? '—'}</td></tr>
      <tr><td class="label">Address</td><td>${invoice.buyerAddress ?? '—'}</td></tr>
    </table>
  </div>

  <div class="box">
    <h3>Vehicle</h3>
    <table>
      <tr><td class="label">Vehicle</td><td>${invoice.vehicleBrand ?? ''} ${invoice.vehicleModel ?? ''} ${invoice.vehicleYear ?? ''}</td></tr>
      <tr><td class="label">Condition</td><td>${invoice.vehicleCondition ?? '—'}</td></tr>
      <tr><td class="label">Location</td><td>${invoice.vehicleLocation ?? '—'}</td></tr>
    </table>
  </div>

  <div class="box">
    <h3>Amount due</h3>
    <table>
      <tr><td class="label">Total (USD)</td><td><strong>${formatMoney(invoice.totalAmountUsd, 'USD')}</strong></td></tr>
      <tr><td class="label">Total (RWF)</td><td>${formatMoney(invoice.totalAmountRwf, 'RWF')}</td></tr>
    </table>
  </div>

  <div class="box">
    <h3>Bank details</h3>
    <table>
      <tr><td class="label">Beneficiary</td><td>${invoice.beneficiaryName ?? companyName}</td></tr>
      <tr><td class="label">Bank</td><td>${bankName}</td></tr>
      <tr><td class="label">Account</td><td>${accountNumber}</td></tr>
      <tr><td class="label">Payment deadline</td><td>${invoice.paymentDeadline?.toISOString().slice(0, 10) ?? '—'}</td></tr>
    </table>
  </div>

  ${invoice.notes ? `<div class="box"><h3>Notes</h3><p>${invoice.notes}</p></div>` : ''}
</body>
</html>`;
  }
}
