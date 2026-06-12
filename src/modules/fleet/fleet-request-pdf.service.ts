import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { HtmlToPdfService } from '../../common/pdf/html-to-pdf.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { FleetPdfStorageService } from './fleet-pdf-storage.service';

const EMAIL_LOGO_FILENAME = 'FInal-logo-dashboard.png';

export type FleetRequestPdfContext = {
  referenceNumber: string;
  organizationName: string;
  contactPerson: string;
  email: string;
  phone: string;
  buyerType: string;
  quantity: number;
  vehicleCategoryName?: string | null;
  vehicleSubcategoryName?: string | null;
  useCase?: string | null;
  notes?: string | null;
};

export type GeneratedFleetPdfAsset = {
  summaryPdfUrl: string;
  pdfBuffer: Buffer;
};

@Injectable()
export class FleetRequestPdfService {
  private readonly logger = new Logger(FleetRequestPdfService.name);

  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly htmlToPdf: HtmlToPdfService,
    private readonly fleetPdfStorage: FleetPdfStorageService,
  ) {}

  async generate(
    context: FleetRequestPdfContext,
  ): Promise<GeneratedFleetPdfAsset> {
    const html = await this.renderHtml(context);
    const pdfBuffer = await this.htmlToPdf.render(html);
    const summaryPdfUrl = await this.fleetPdfStorage.saveFleetPdf(
      context.referenceNumber,
      pdfBuffer,
    );

    this.logger.log(`Fleet request PDF stored for ${context.referenceNumber}`);
    return { summaryPdfUrl, pdfBuffer };
  }

  private async renderHtml(context: FleetRequestPdfContext): Promise<string> {
    const company =
      await this.platformSettingsService.getCompanyPaymentDetails();
    const issuedAt = new Date();
    const logoDataUri = this.readLogoDataUri();
    const logoHtml = logoDataUri
      ? `<img class="logo" src="${logoDataUri}" alt="${this.escapeHtml(company.legalName)}" />`
      : `<strong>${this.escapeHtml(company.legalName)}</strong>`;

    const vehicleInterest = [
      context.vehicleCategoryName,
      context.vehicleSubcategoryName,
    ]
      .filter(Boolean)
      .join(' · ');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(context.referenceNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #151515; margin: 32px; font-size: 13px; }
    h1 { color: #174438; margin: 0; font-size: 22px; }
    .muted { color: #356769; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; align-items: flex-start; }
    .logo { height: 48px; width: auto; display: block; }
    .box { border: 1px solid #e9e9e9; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e9e9e9; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f8faf9; width: 34%; }
    .badge { display: inline-block; background: #174438; color: #fff; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; margin-bottom: 8px; text-transform: uppercase; }
    ul { margin: 8px 0 0 18px; padding: 0; }
    li { margin-bottom: 6px; }
    .footer { margin-top: 24px; font-size: 12px; color: #356769; display: flex; justify-content: space-between; }
    .notice { background: #e8f4fc; padding: 16px; border-radius: 8px; margin: 16px 0; }
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
      <div class="badge">Fleet request</div>
      <h1>FLEET REQUEST SUMMARY</h1>
      <div><strong>${this.escapeHtml(context.referenceNumber)}</strong></div>
      <div>Submitted: ${issuedAt.toLocaleDateString('en-GB')}</div>
    </div>
  </div>

  <div class="cols">
    <div class="box">
      <strong>Organization</strong><br />
      ${this.escapeHtml(context.organizationName)}<br />
      ${this.escapeHtml(context.contactPerson)}<br />
      ${this.escapeHtml(context.email)}<br />
      ${this.escapeHtml(context.phone)}
    </div>
    <div class="box">
      <strong>Request overview</strong><br />
      Buyer type: ${this.escapeHtml(context.buyerType.replace(/_/g, ' '))}<br />
      Fleet size: ${context.quantity} vehicle(s)<br />
      Primary interest: ${this.escapeHtml(vehicleInterest || 'To be confirmed')}<br />
      ${context.useCase ? `Use case: ${this.escapeHtml(context.useCase.replace(/_/g, ' '))}<br />` : ''}
    </div>
  </div>

  <table>
    <tbody>
      <tr><th>Reference</th><td>${this.escapeHtml(context.referenceNumber)}</td></tr>
      <tr><th>Organization</th><td>${this.escapeHtml(context.organizationName)}</td></tr>
      <tr><th>Contact person</th><td>${this.escapeHtml(context.contactPerson)}</td></tr>
      <tr><th>Email</th><td>${this.escapeHtml(context.email)}</td></tr>
      <tr><th>Phone</th><td>${this.escapeHtml(context.phone)}</td></tr>
      <tr><th>Fleet size</th><td>${context.quantity} vehicle(s)</td></tr>
      <tr><th>Vehicle category</th><td>${this.escapeHtml(vehicleInterest || 'To be confirmed')}</td></tr>
      ${
        context.notes
          ? `<tr><th>Requirements</th><td>${this.escapeHtml(context.notes)}</td></tr>`
          : ''
      }
    </tbody>
  </table>

  <div class="notice">
    <strong>What happens next</strong>
    <p style="margin: 8px 0 0">We received your fleet request and our commercial team will contact you within 24 hours to discuss sourcing, financing, and charging infrastructure options tailored to your operations.</p>
    <p style="margin: 8px 0 0"><strong>Pricing is not included in this document.</strong> A dedicated advisor will share commercial terms after reviewing your requirements.</p>
  </div>

  <div class="box">
    <strong>Notes</strong>
    <ul>
      <li>This summary confirms what you submitted. It is not a quote or proforma invoice.</li>
      <li>Bulk pricing, delivery timelines, and financing are prepared after our team reviews your fleet profile.</li>
      <li>Reply to your confirmation email or contact us on WhatsApp with your reference number.</li>
    </ul>
  </div>

  <div class="footer">
    <span>${this.escapeHtml(company.legalName)} · Kigali, Rwanda</span>
    <span>Generated automatically — our team will follow up shortly.</span>
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
      } catch (error) {
        this.logger.warn(`Could not read logo at ${filePath}`, error);
      }
    }

    return null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
