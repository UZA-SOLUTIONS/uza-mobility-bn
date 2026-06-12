import { InquiryIntent } from '@prisma/client';
import {
  buildBrandedEmailHtml,
  escapeHtml,
  type BrandedEmailParams,
} from './email-template.util';
import type { InquiryListingContext } from '../../modules/inquiries/inquiry.mapper';

export type CommerceConfirmationEmailParams = {
  appName: string;
  frontendUrl: string;
  recipientName: string;
  listing: InquiryListingContext;
  referenceNumber: string;
  intent: InquiryIntent;
  company: {
    legalName: string;
    bankName: string;
    accountNumber: string;
    whatsappNumber: string;
  };
  bookingFeeUsd: number;
  whatsappUrl?: string;
  /** When set, show account CTA instead of WhatsApp (authenticated buyers). */
  accountActionUrl?: string;
  accountActionLabel?: string;
  footerReason?: string;
};

export function buildCommerceConfirmationEmail(
  params: CommerceConfirmationEmailParams,
): { subject: string; html: string; text: string } {
  const isBuy = params.intent === InquiryIntent.BUY;
  const priceUsd = params.listing.listingPricing?.finalPriceUsd;
  const priceLabel =
    priceUsd != null ? `USD ${priceUsd.toLocaleString('en-US')}` : 'On request';
  const bookingFeeLabel = `USD ${params.bookingFeeUsd.toLocaleString('en-US')}`;
  const deliveryDays = params.listing.deliveryEstimateDays;
  const firstName = params.recipientName.split(' ')[0] ?? params.recipientName;

  const formatPaymentBlock = () => `
        <p style="margin: 12px 0 0">How to pay</p>
        <ul style="margin: 4px 0 0; padding-left: 18px; color: #424a53; font-size: 14px; line-height: 22px">
          <li>Beneficiary: ${escapeHtml(params.company.legalName)}</li>
          <li>Bank: ${escapeHtml(params.company.bankName)}</li>
          <li>Account: ${escapeHtml(params.company.accountNumber)}</li>
          <li>Currency: USD · Method: TT bank transfer</li>
          <li>Payment reference: ${escapeHtml(params.referenceNumber)}</li>
        </ul>`;

  const bodyHtml = isBuy
    ? `
        <p style="margin: 0 0 12px">Thank you for your interest in purchasing ${escapeHtml(params.listing.listingTitle)}.</p>
        <p style="margin: 0 0 12px">We received your request and attached a reference document (${escapeHtml(params.referenceNumber)}).</p>
        <ul style="margin: 0 0 12px; padding-left: 18px; color: #424a53; font-size: 14px; line-height: 22px">
          <li>Vehicle: ${escapeHtml(params.listing.listingTitle)}</li>
          <li>Vehicle price: ${priceLabel}</li>
          <li>Delivery estimate: ${deliveryDays != null ? `${deliveryDays} days` : 'Confirmed after payment'}</li>
          <li>Seller: ${escapeHtml(params.listing.sellerType.replace(/_/g, ' '))}</li>
        </ul>
        <p style="margin: 0 0 12px">To proceed with your purchase, transfer the full vehicle price (${priceLabel}) using the bank details below. Include reference ${escapeHtml(params.referenceNumber)} in your transfer.</p>
        ${formatPaymentBlock()}
        <p style="margin: 12px 0 0">This vehicle is not reserved until payment is confirmed. Contact us if you have questions.</p>`
    : `
        <p style="margin: 0 0 12px">Thank you for your interest in booking ${escapeHtml(params.listing.listingTitle)}.</p>
        <p style="margin: 0 0 12px">We received your request and attached a reference quote (${escapeHtml(params.referenceNumber)}).</p>
        <ul style="margin: 0 0 12px; padding-left: 18px; color: #424a53; font-size: 14px; line-height: 22px">
          <li>Vehicle: ${escapeHtml(params.listing.listingTitle)}</li>
          <li>Vehicle price: ${priceLabel}</li>
          <li>Booking fee to confirm: ${bookingFeeLabel}</li>
          <li>Delivery estimate: ${deliveryDays != null ? `${deliveryDays} days` : 'Confirmed at reservation'}</li>
          <li>Seller: ${escapeHtml(params.listing.sellerType.replace(/_/g, ' '))}</li>
        </ul>
        <p style="margin: 0 0 12px">To secure this vehicle, pay the booking fee (${bookingFeeLabel}) using the bank details below. Include reference ${escapeHtml(params.referenceNumber)} in your transfer. The remaining balance is due before delivery.</p>
        ${formatPaymentBlock()}
        <p style="margin: 12px 0 0">This vehicle is not reserved until your booking fee is confirmed. Contact us if you have questions.</p>`;

  const brandedParams: BrandedEmailParams = {
    appName: params.appName,
    recipientName: firstName,
    headline: isBuy
      ? 'Your vehicle purchase details'
      : 'Your vehicle booking quote',
    bodyHtml,
    logoUrl: '',
    companyLegalName: params.company.legalName,
    websiteUrl: params.frontendUrl,
    supportUrl: params.accountActionUrl ?? `${params.frontendUrl}/about`,
    footerReason:
      params.footerReason ??
      `You are receiving this email because of activity on ${params.appName}.`,
  };

  if (params.accountActionUrl && params.accountActionLabel) {
    brandedParams.actionUrl = params.accountActionUrl;
    brandedParams.actionLabel = params.accountActionLabel;
  } else if (params.whatsappUrl) {
    brandedParams.actionUrl = params.whatsappUrl;
    brandedParams.actionLabel = 'Chat on WhatsApp';
  }

  const html = buildBrandedEmailHtml(brandedParams);
  const subject = isBuy
    ? `Your vehicle purchase details — ${params.listing.listingTitle}`
    : `Your vehicle booking quote — ${params.listing.listingTitle}`;
  const text = isBuy
    ? `Thank you ${params.recipientName}. Your purchase reference ${params.referenceNumber} for ${params.listing.listingTitle} is attached. Vehicle price: ${priceLabel}. Transfer the full amount with reference ${params.referenceNumber} to proceed.`
    : `Thank you ${params.recipientName}. Your booking quote ${params.referenceNumber} for ${params.listing.listingTitle} is attached. Vehicle price: ${priceLabel}. Booking fee: ${bookingFeeLabel}. Pay the booking fee with reference ${params.referenceNumber} to secure the vehicle.`;

  return { subject, html, text };
}
