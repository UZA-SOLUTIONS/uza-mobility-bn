import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { InquiryIntent, SellerType } from '@prisma/client';
import { HtmlToPdfService } from '../../common/pdf/html-to-pdf.service';
import { toAbsoluteUploadUrl } from '../../common/uploads/storage.paths';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDiscountRatePercentFromPriceNotes } from '../listings/listing-pricing.util';
import type { InquiryListingContext } from './inquiry.mapper';
import { QuoteStorageService } from './quote-storage.service';

const QUOTE_VALIDITY_DAYS = 30;
const EMAIL_LOGO_FILENAME = 'FInal-logo-dashboard.png';

export type GeneratedQuoteAsset = {
  quotePdfUrl: string;
  pdfBuffer: Buffer;
};

@Injectable()
export class QuotePdfService {
  private readonly logger = new Logger(QuotePdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly htmlToPdf: HtmlToPdfService,
    private readonly quoteStorage: QuoteStorageService,
  ) {}

  async generate(
    inquiryId: string,
    quoteNumber: string,
    intent: InquiryIntent,
    listing: InquiryListingContext,
    buyer: {
      name: string;
      email: string;
      phone: string;
      country: string;
      buyerType: string;
    },
  ): Promise<GeneratedQuoteAsset> {
    const html = await this.renderHtml(quoteNumber, intent, listing, buyer);
    const pdfBuffer = await this.htmlToPdf.render(html);
    const quotePdfUrl = await this.quoteStorage.saveQuotePdf(
      quoteNumber,
      pdfBuffer,
    );

    await this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: { quotePdfUrl },
    });

    this.logger.log(`Quote PDF stored for ${quoteNumber}`);
    return { quotePdfUrl, pdfBuffer };
  }

  async readPdfBuffer(
    quotePdfUrl: string | null | undefined,
  ): Promise<Buffer | null> {
    return this.quoteStorage.readQuotePdf(quotePdfUrl);
  }

  /** Generate a quote/purchase PDF without persisting to an inquiry record. */
  async generateBuffer(
    referenceNumber: string,
    intent: InquiryIntent,
    listing: InquiryListingContext,
    buyer: {
      name: string;
      email: string;
      phone: string;
      country: string;
      buyerType: string;
    },
  ): Promise<Buffer> {
    const html = await this.renderHtml(referenceNumber, intent, listing, buyer);
    return this.htmlToPdf.render(html);
  }

  private async renderHtml(
    quoteNumber: string,
    intent: InquiryIntent,
    listing: InquiryListingContext,
    buyer: {
      name: string;
      email: string;
      phone: string;
      country: string;
      buyerType: string;
    },
  ): Promise<string> {
    const isBuy = intent === InquiryIntent.BUY;
    const [company, bookingFeeUsd] = await Promise.all([
      this.platformSettingsService.getCompanyPaymentDetails(),
      this.platformSettingsService.getBookingFeeUsd(),
    ]);
    const issuedAt = new Date();
    const validUntil = new Date(issuedAt);
    validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS);

    const pricing = listing.listingPricing;
    const totalUsd = pricing?.finalPriceUsd ?? 0;
    const delivery = this.deliverySummary(listing);
    const priceRows = this.priceRows(listing, totalUsd, isBuy, bookingFeeUsd);
    const ev = listing.evSpecs;
    const logoDataUri = this.readLogoDataUri();
    const vehicleImageDataUri = await this.resolveVehicleImageDataUri(listing);

    const formatMoney = (value: number) =>
      `USD ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

    const specLine = [
      listing.color,
      listing.drivetrain?.replace(/_/g, ' '),
      ev?.batteryCapacityKwh != null ? `${ev.batteryCapacityKwh} kWh` : null,
      ev?.rangeKm != null ? `${Math.round(ev.rangeKm)} km range` : null,
      listing.mileageKm != null ? `${Math.round(listing.mileageKm)} km` : null,
      listing.bodyType?.replace(/_/g, ' '),
    ]
      .filter(Boolean)
      .join(' · ');

    const docTitle = isBuy ? 'VEHICLE PURCHASE QUOTE' : 'VEHICLE BOOKING QUOTE';
    const amountDueNow = isBuy ? totalUsd : bookingFeeUsd;
    const amountDueLabel = isBuy
      ? 'Amount due (full vehicle price)'
      : 'Amount due now (booking fee)';
    const paymentIntro = isBuy
      ? `Transfer the <strong>full vehicle price (${formatMoney(totalUsd)})</strong> to proceed with your purchase.`
      : `Pay the <strong>booking fee (${formatMoney(bookingFeeUsd)})</strong> to secure this vehicle. The remaining balance (${formatMoney(totalUsd)}) is due before delivery.`;

    const vehicleImageHtml = vehicleImageDataUri
      ? `<div class="vehicle-image"><img src="${vehicleImageDataUri}" alt="${this.escapeHtml(listing.listingTitle)}" /></div>`
      : '';

    const logoHtml = logoDataUri
      ? `<img class="logo" src="${logoDataUri}" alt="${this.escapeHtml(company.legalName)}" />`
      : `<strong>${this.escapeHtml(company.legalName)}</strong>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${quoteNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #151515; margin: 32px; font-size: 13px; }
    h1 { color: #174438; margin: 0; font-size: 22px; }
    .muted { color: #356769; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; align-items: flex-start; }
    .logo { height: 48px; width: auto; display: block; }
    .vehicle-image { margin-bottom: 16px; }
    .vehicle-image img { width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid #e9e9e9; }
    .box { border: 1px solid #e9e9e9; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e9e9e9; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f8faf9; }
    .total { background: #d4e157; font-weight: bold; }
    .due-now { background: #174438; color: #fff; font-weight: bold; }
    .payment { background: #e8f4fc; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .valid { color: #c0392b; font-weight: 600; }
    ul { margin: 8px 0 0 18px; padding: 0; }
    li { margin-bottom: 6px; }
    .footer { margin-top: 24px; font-size: 12px; color: #356769; display: flex; justify-content: space-between; }
    .intent-badge { display: inline-block; background: #174438; color: #fff; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; margin-bottom: 8px; text-transform: uppercase; }
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
      <div class="intent-badge">${isBuy ? 'Purchase' : 'Booking'}</div>
      <h1>${docTitle}</h1>
      <div><strong>${quoteNumber}</strong></div>
      <div>Issue date: ${issuedAt.toLocaleDateString('en-GB')}</div>
      <div class="valid">Valid until: ${validUntil.toLocaleDateString('en-GB')}</div>
    </div>
  </div>

  ${vehicleImageHtml}

  <div class="cols">
    <div class="box">
      <strong>Prepared for</strong><br />
      ${this.escapeHtml(buyer.name)}<br />
      ${this.escapeHtml(buyer.email)}<br />
      ${this.escapeHtml(buyer.phone)}<br />
      ${this.escapeHtml(buyer.buyerType.replace(/_/g, ' '))} · ${this.escapeHtml(buyer.country)}
    </div>
    <div class="box">
      <strong>Shipment &amp; delivery</strong><br />
      Seller: ${this.escapeHtml(listing.sellerType.replace(/_/g, ' '))}<br />
      Origin: ${this.escapeHtml(delivery.origin)}<br />
      Destination: ${this.escapeHtml(delivery.destination)}<br />
      Timeline: ${this.escapeHtml(delivery.timeline)}<br />
      Payment: TT bank transfer
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Ref</th>
        <th>Description</th>
        <th>Condition</th>
        <th>Qty</th>
        <th>Unit price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${listing.id.slice(-8).toUpperCase()}</td>
        <td>
          <strong>${this.escapeHtml(listing.listingTitle)}</strong><br />
          <span class="muted">${this.escapeHtml(listing.brand)} ${this.escapeHtml(listing.model)} ${listing.manufacturingYear}</span><br />
          <span class="muted">${this.escapeHtml(specLine || '—')}</span>
        </td>
        <td>${listing.isNew ? 'New' : this.escapeHtml(listing.condition.replace(/_/g, ' '))}</td>
        <td>1</td>
        <td>${formatMoney(totalUsd)}</td>
        <td>${formatMoney(totalUsd)}</td>
      </tr>
    </tbody>
  </table>

  <div class="box">
    <strong>Price breakdown</strong>
    <table>
      <tbody>
        ${priceRows
          .map(
            (row) =>
              `<tr class="${row.dueNow ? 'due-now' : row.total ? 'total' : ''}"><td colspan="5">${row.label}</td><td>${formatMoney(row.amount)}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="payment">
    <strong>Payment instructions</strong><br />
    <p style="margin: 8px 0">${paymentIntro}</p>
    Beneficiary: ${this.escapeHtml(company.legalName)}<br />
    Bank: ${this.escapeHtml(company.bankName)}<br />
    Account: ${this.escapeHtml(company.accountNumber)}<br />
    Currency: USD<br />
    <strong>${amountDueLabel}: ${formatMoney(amountDueNow)}</strong><br />
    <strong>Payment reference: ${quoteNumber}</strong> (include in your transfer)<br />
    Method: TT bank transfer only
  </div>

  <div class="box">
    <strong>Terms &amp; notes</strong>
    <ul>
      ${
        isBuy
          ? `<li>This document is for your purchase request. The vehicle is not reserved until full payment is confirmed and a Proforma Invoice is issued.</li>
      <li>Transfer the full quoted vehicle price using the bank details above.</li>`
          : `<li>This document is for your booking request. The vehicle is not reserved until the booking fee is confirmed.</li>
      <li>Pay the booking fee first to secure the vehicle. The remaining balance is due before delivery.</li>`
      }
      <li>Pricing is an estimate. Shipping, taxes, and local charges may vary. Final figures appear on the Proforma Invoice.</li>
      <li>All bank transfer charges are borne by the buyer.</li>
      <li>To proceed, reply to your confirmation email or contact us on WhatsApp with your quote number.</li>
      <li>This quote is valid for ${QUOTE_VALIDITY_DAYS} days from the issue date.</li>
      <li>Financing facilitation is available upon request. Uza Mobility does not provide financing directly.</li>
    </ul>
  </div>

  <div class="footer">
    <span>${this.escapeHtml(company.legalName)} · Kigali, Rwanda</span>
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
      } catch (error) {
        this.logger.warn(`Could not read logo at ${filePath}`, error);
      }
    }

    return null;
  }

  private resolvePrimaryPhotoUrl(
    listing: InquiryListingContext,
  ): string | null {
    const photos = listing.photos ?? [];
    if (!photos.length) return null;

    const primary =
      photos.find((photo) => photo.isPrimary) ??
      [...photos].sort((a, b) => a.displayOrder - b.displayOrder)[0];

    return toAbsoluteUploadUrl(primary.url);
  }

  private async resolveVehicleImageDataUri(
    listing: InquiryListingContext,
  ): Promise<string | null> {
    const photoUrl = this.resolvePrimaryPhotoUrl(listing);
    if (!photoUrl) return null;

    try {
      const response = await fetch(photoUrl);
      if (!response.ok) {
        this.logger.warn(
          `Vehicle image fetch failed (${response.status}) for ${photoUrl}`,
        );
        return photoUrl;
      }

      const contentType =
        response.headers.get('content-type')?.split(';')[0]?.trim() ||
        'image/jpeg';
      const buffer = Buffer.from(await response.arrayBuffer());
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch (error) {
      this.logger.warn(`Vehicle image fetch error for ${photoUrl}`, error);
      return photoUrl;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private deliverySummary(listing: InquiryListingContext) {
    switch (listing.sellerType) {
      case SellerType.UZA_RWANDA_STOCK:
        return {
          origin: 'Kigali, Rwanda',
          destination: listing.city ?? 'Kigali, Rwanda',
          timeline:
            listing.deliveryEstimateDays != null
              ? `${listing.deliveryEstimateDays} days after payment`
              : '1–2 days after payment',
        };
      case SellerType.UZA_CHINA_SOURCING:
        return {
          origin: 'China',
          destination: 'Kigali, Rwanda',
          timeline:
            listing.deliveryEstimateDays != null
              ? `~${listing.deliveryEstimateDays} days`
              : '6–8 weeks',
        };
      case SellerType.LOCAL_SELLER:
        return {
          origin: listing.city ?? listing.seller.city ?? 'Rwanda',
          destination: listing.city ?? 'Kigali, Rwanda',
          timeline:
            listing.deliveryEstimateDays != null
              ? `${listing.deliveryEstimateDays} days`
              : '2–5 days',
        };
      default:
        return {
          origin: listing.country ?? listing.seller.country ?? 'International',
          destination: 'Kigali, Rwanda',
          timeline:
            listing.deliveryEstimateDays != null
              ? `~${listing.deliveryEstimateDays} days`
              : 'Route-based estimate',
        };
    }
  }

  private priceRows(
    listing: InquiryListingContext,
    totalUsd: number,
    isBuy: boolean,
    bookingFeeUsd: number,
  ): Array<{
    label: string;
    amount: number;
    total?: boolean;
    dueNow?: boolean;
  }> {
    const p = listing.listingPricing;
    const rows: Array<{
      label: string;
      amount: number;
      total?: boolean;
      dueNow?: boolean;
    }> = [];

    if (
      listing.sellerType === SellerType.UZA_CHINA_SOURCING ||
      listing.sellerType === SellerType.INTERNATIONAL_SELLER
    ) {
      rows.push(
        { label: 'Vehicle price (FOB)', amount: p?.fobPriceUsd ?? totalUsd },
        { label: 'Estimated shipping', amount: p?.shippingCostUsd ?? 0 },
        { label: 'Local charges', amount: p?.localChargesUsd ?? 0 },
        {
          label: 'Taxes and fees (estimate)',
          amount: p?.taxesEstimateUsd ?? 0,
        },
        { label: 'Insurance (estimate)', amount: p?.insuranceUsd ?? 0 },
        {
          label: 'Clearing and declaration fee',
          amount: p?.clearingFeeUsd ?? 0,
        },
        { label: 'Estimated landing cost', amount: p?.landingCostUsd ?? 0 },
        { label: 'UZA service margin', amount: p?.marginUsd ?? 0 },
      );
      const discount = p?.ruleDiscountUsd ?? 0;
      const legacyListingDiscount = p?.discountUsd ?? 0;
      const discountLabel = this.discountLabel(p?.priceNotes);
      if (discount > 0) {
        rows.push({ label: discountLabel, amount: -discount });
      } else if (legacyListingDiscount > 0) {
        rows.push({ label: discountLabel, amount: -legacyListingDiscount });
      }
      rows.push({
        label: 'TOTAL VEHICLE PRICE',
        amount: totalUsd,
        total: true,
      });
    } else if (listing.sellerType === SellerType.UZA_RWANDA_STOCK) {
      const discount = p?.ruleDiscountUsd ?? 0;
      const legacyListingDiscount = p?.discountUsd ?? 0;
      const totalDiscount = discount + legacyListingDiscount;
      rows.push({
        label: 'Vehicle price',
        amount: totalUsd + totalDiscount,
      });
      if (totalDiscount > 0) {
        rows.push({
          label: this.discountLabel(p?.priceNotes),
          amount: -totalDiscount,
        });
      }
      rows.push({
        label: 'TOTAL VEHICLE PRICE',
        amount: totalUsd,
        total: true,
      });
    } else {
      rows.push({ label: 'Vehicle price', amount: totalUsd, total: true });
    }

    if (isBuy) {
      rows.push({
        label: 'AMOUNT DUE (FULL PURCHASE)',
        amount: totalUsd,
        dueNow: true,
      });
    } else {
      rows.push({
        label: 'Booking fee (pay now to confirm)',
        amount: bookingFeeUsd,
      });
      rows.push({
        label: 'AMOUNT DUE NOW (BOOKING FEE)',
        amount: bookingFeeUsd,
        dueNow: true,
      });
    }

    return rows;
  }

  private discountLabel(priceNotes: string | null | undefined): string {
    const rate = parseDiscountRatePercentFromPriceNotes(priceNotes);
    if (rate == null) return 'Discount';
    const formatted = Number.isInteger(rate) ? String(rate) : rate.toFixed(2);
    return `Discount (${formatted}%)`;
  }
}
