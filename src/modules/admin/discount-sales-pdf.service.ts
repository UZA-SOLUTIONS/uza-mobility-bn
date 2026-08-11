import { Injectable } from '@nestjs/common';
import { formatDualMoney } from '../../common/money/money-format.util';
import { HtmlToPdfService } from '../../common/pdf/html-to-pdf.service';
import { ExchangeRateService } from '../platform-settings/exchange-rate.service';
import type {
  DiscountSaleRow,
  DiscountSalesSummary,
} from './discount-sales.service';

@Injectable()
export class DiscountSalesPdfService {
  constructor(
    private readonly htmlToPdf: HtmlToPdfService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async render(
    items: DiscountSaleRow[],
    summary: DiscountSalesSummary,
    filters: { from?: string; to?: string },
  ): Promise<Buffer> {
    const rate = (
      await this.exchangeRateService.getSnapshot({ refreshIfStale: false })
    ).usdToRwfEffective;
    const html = this.buildHtml(items, summary, filters, rate);
    return this.htmlToPdf.render(html);
  }

  private formatMoney(value: number, rate: number): string {
    return formatDualMoney(value, rate, { unit: 'USDT', empty: '—' });
  }

  private formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  private buildHtml(
    items: DiscountSaleRow[],
    summary: DiscountSalesSummary,
    filters: { from?: string; to?: string },
    rate: number,
  ): string {
    const period =
      filters.from || filters.to
        ? `${filters.from ? this.formatDate(filters.from) : 'Start'} – ${filters.to ? this.formatDate(filters.to) : 'Present'}`
        : 'All time';

    const rows = items
      .map(
        (row) => `<tr>
          <td>${this.escapeHtml(row.invoiceNumber)}</td>
          <td>${this.formatDate(row.soldAt)}</td>
          <td>${this.escapeHtml([row.vehicleBrand, row.vehicleModel, row.vehicleYear].filter(Boolean).join(' '))}</td>
          <td>${this.escapeHtml(row.buyerName)}</td>
          <td class="num">${this.formatMoney(row.ruleDiscountUsd, rate)}</td>
          <td class="num">${this.formatMoney(row.listingDiscountUsd, rate)}</td>
          <td class="num">${this.formatMoney(row.totalDiscountUsd, rate)}</td>
          <td class="num">${this.formatMoney(row.amountPaidUsd, rate)}</td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Discount sales report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #151515; margin: 32px; font-size: 12px; }
    h1 { color: #174438; margin: 0 0 8px; font-size: 22px; }
    .muted { color: #356769; margin-bottom: 24px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .card { border: 1px solid #e9e9e9; border-radius: 8px; padding: 12px; }
    .card strong { display: block; font-size: 14px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e9e9e9; padding: 8px 6px; text-align: left; }
    th { color: #356769; font-weight: 600; }
    .num { text-align: right; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>Discount sales report</h1>
  <p class="muted">Period: ${this.escapeHtml(period)} · Generated ${this.escapeHtml(new Date().toLocaleString('en-US'))}</p>
  <div class="summary">
    <div class="card"><span class="muted">Vehicles sold with discount</span><strong>${summary.saleCount}</strong></div>
    <div class="card"><span class="muted">Rule discounts</span><strong>${this.formatMoney(summary.totalRuleDiscountUsd, rate)}</strong></div>
    <div class="card"><span class="muted">Listing discounts</span><strong>${this.formatMoney(summary.totalListingDiscountUsd, rate)}</strong></div>
    <div class="card"><span class="muted">Total discount given</span><strong>${this.formatMoney(summary.totalDiscountUsd, rate)}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Invoice</th>
        <th>Sold</th>
        <th>Vehicle</th>
        <th>Buyer</th>
        <th class="num">Rule disc.</th>
        <th class="num">Listing disc.</th>
        <th class="num">Total disc.</th>
        <th class="num">Paid</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8">No discounted sales in this period.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
  }
}
