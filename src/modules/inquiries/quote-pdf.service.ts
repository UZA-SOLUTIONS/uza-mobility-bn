import { Injectable, Logger } from '@nestjs/common';
import { SellerType } from '@prisma/client';
import { HtmlToPdfService } from '../../common/pdf/html-to-pdf.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { InquiryListingContext } from './inquiry.mapper';
import { QuoteStorageService } from './quote-storage.service';

const QUOTE_VALIDITY_DAYS = 30;

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
    listing: InquiryListingContext,
    buyer: {
      name: string;
      email: string;
      phone: string;
      country: string;
      buyerType: string;
    },
  ): Promise<GeneratedQuoteAsset> {
    const html = await this.renderHtml(quoteNumber, listing, buyer);
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

  private async renderHtml(
    quoteNumber: string,
    listing: InquiryListingContext,
    buyer: {
      name: string;
      email: string;
      phone: string;
      country: string;
      buyerType: string;
    },
  ): Promise<string> {
    const company =
      await this.platformSettingsService.getCompanyPaymentDetails();
    const issuedAt = new Date();
    const validUntil = new Date(issuedAt);
    validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS);

    const pricing = listing.listingPricing;
    const totalUsd = pricing?.finalPriceUsd ?? 0;
    const delivery = this.deliverySummary(listing);
    const priceRows = this.priceRows(listing, totalUsd);
    const ev = listing.evSpecs;

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

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${quoteNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #151515; margin: 32px; font-size: 13px; }
    h1 { color: #174438; margin: 0; font-size: 22px; }
    .muted { color: #356769; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .box { border: 1px solid #e9e9e9; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e9e9e9; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f8faf9; }
    .total { background: #d4e157; font-weight: bold; }
    .payment { background: #e8f4fc; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .valid { color: #c0392b; font-weight: 600; }
    ul { margin: 8px 0 0 18px; padding: 0; }
    li { margin-bottom: 6px; }
    .footer { margin-top: 24px; font-size: 12px; color: #356769; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <strong>${company.legalName}</strong><br />
      <span class="muted">Kigali, Rwanda</span><br />
      <span class="muted">info@uzamobility.com</span>
    </div>
    <div style="text-align:right">
      <h1>VEHICLE QUOTE</h1>
      <div><strong>${quoteNumber}</strong></div>
      <div>Issue date: ${issuedAt.toLocaleDateString('en-GB')}</div>
      <div class="valid">Valid until: ${validUntil.toLocaleDateString('en-GB')}</div>
    </div>
  </div>

  <div class="cols">
    <div class="box">
      <strong>Prepared for</strong><br />
      ${buyer.name}<br />
      ${buyer.email}<br />
      ${buyer.phone}<br />
      ${buyer.buyerType.replace(/_/g, ' ')} · ${buyer.country}
    </div>
    <div class="box">
      <strong>Shipment &amp; delivery</strong><br />
      Seller type: ${listing.sellerType.replace(/_/g, ' ')}<br />
      Origin: ${delivery.origin}<br />
      Destination: ${delivery.destination}<br />
      Timeline: ${delivery.timeline}<br />
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
          <strong>${listing.listingTitle}</strong><br />
          <span class="muted">${listing.brand} ${listing.model} ${listing.manufacturingYear}</span><br />
          <span class="muted">${specLine || '—'}</span>
        </td>
        <td>${listing.isNew ? 'New' : listing.condition.replace(/_/g, ' ')}</td>
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
              `<tr${row.total ? ' class="total"' : ''}><td colspan="5">${row.label}</td><td>${formatMoney(row.amount)}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="payment">
    <strong>Payment instructions</strong><br />
    Beneficiary: ${company.legalName}<br />
    Bank: ${company.bankName}<br />
    Account: ${company.accountNumber}<br />
    Currency: USD<br />
    <strong>Payment reference: ${quoteNumber}</strong> (include in your transfer)<br />
    Method: TT bank transfer only
  </div>

  <div class="box">
    <strong>Terms &amp; notes</strong>
    <ul>
      <li>This quote is for reference only. The vehicle is not reserved until payment is confirmed and a Proforma Invoice is issued.</li>
      <li>Pricing is an estimate. Shipping, taxes, and local charges may vary. Final figures appear on the Proforma Invoice.</li>
      <li>All bank transfer charges are borne by the buyer.</li>
      <li>To proceed, reply to your confirmation email or contact us on WhatsApp with your quote number.</li>
      <li>This quote is valid for ${QUOTE_VALIDITY_DAYS} days from the issue date.</li>
      <li>Financing facilitation is available upon request. Uza Mobility does not provide financing directly.</li>
    </ul>
  </div>

  <div class="footer">
    <span>${company.legalName} · Kigali, Rwanda</span>
    <span>Generated automatically — contact our team for questions.</span>
  </div>
</body>
</html>`;
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
  ): Array<{ label: string; amount: number; total?: boolean }> {
    const p = listing.listingPricing;
    if (
      listing.sellerType === SellerType.UZA_CHINA_SOURCING ||
      listing.sellerType === SellerType.INTERNATIONAL_SELLER
    ) {
      return [
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
        { label: 'TOTAL QUOTED PRICE', amount: totalUsd, total: true },
      ];
    }

    if (listing.sellerType === SellerType.UZA_RWANDA_STOCK) {
      const discount = p?.discountUsd ?? 0;
      return [
        { label: 'Vehicle price', amount: totalUsd + discount },
        ...(discount > 0 ? [{ label: 'Discount', amount: -discount }] : []),
        { label: 'TOTAL QUOTED PRICE', amount: totalUsd, total: true },
      ];
    }

    return [{ label: 'Marketplace price', amount: totalUsd, total: true }];
  }
}
