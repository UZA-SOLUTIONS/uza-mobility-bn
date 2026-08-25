import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_FROZEN_USD_TO_RWF,
  DEFAULT_RWF_MARKUP_PERCENT,
  PLATFORM_SETTING_KEYS,
  type ExchangeRateSnapshot,
} from './platform-settings.constants';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMarkupPercent(): Promise<number> {
    const raw = await this.getSetting(
      PLATFORM_SETTING_KEYS.rwfMarkupPercent,
      String(DEFAULT_RWF_MARKUP_PERCENT),
    );
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_RWF_MARKUP_PERCENT;
  }

  /**
   * Frozen USDT→RWF rate from platform settings. Live API refresh is disabled.
   */
  async getSnapshot(_options?: {
    refreshIfStale?: boolean;
  }): Promise<ExchangeRateSnapshot> {
    const apiRate = await this.getCachedNumber(PLATFORM_SETTING_KEYS.usdToRwfApi);
    let effective = await this.getCachedNumber(
      PLATFORM_SETTING_KEYS.usdToRwfEffective,
    );
    const fetchedAt = await this.getCachedDate(
      PLATFORM_SETTING_KEYS.rateFetchedAt,
    );
    const markupPercent = await this.getMarkupPercent();

    if (!effective) {
      this.logger.warn(
        'Frozen usdToRwfEffective is empty; using fallback rate for leftover USD listings',
      );
      effective = apiRate
        ? apiRate * (1 + markupPercent / 100)
        : DEFAULT_FROZEN_USD_TO_RWF;
    }

    return {
      usdToRwfApi: apiRate ?? effective,
      usdToRwfEffective: effective,
      markupPercent,
      rateFetchedAt: fetchedAt?.toISOString() ?? null,
      baseCurrency: 'USDT',
      quoteCurrency: 'RWF',
      frozen: true,
    };
  }

  async getFrozenRate(): Promise<number> {
    const snapshot = await this.getSnapshot();
    return snapshot.usdToRwfEffective;
  }

  async setFrozenRate(
    usdToRwfEffective: number,
    adminId?: string,
  ): Promise<ExchangeRateSnapshot> {
    await this.upsertSetting(
      PLATFORM_SETTING_KEYS.usdToRwfEffective,
      String(usdToRwfEffective),
      adminId,
    );
    await this.upsertSetting(
      PLATFORM_SETTING_KEYS.rateFetchedAt,
      new Date().toISOString(),
      adminId,
    );
    await this.prisma.$executeRaw`
      UPDATE "listing_pricing"
      SET "displayPriceRwf" = ROUND("finalPriceUsd" * ${usdToRwfEffective})
      WHERE "currency" = 'USD'
        AND "finalPriceUsd" IS NOT NULL
    `;
    return this.getSnapshot();
  }

  usdtToRwf(amountUsdt: number, effectiveRate: number): number {
    return Math.round(amountUsdt * effectiveRate);
  }

  private upsertSetting(key: string, value: string, adminId?: string) {
    return this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: adminId },
      update: { value, updatedBy: adminId },
    });
  }

  private async getSetting(key: string, fallback: string): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key },
    });
    const value = row?.value?.trim();
    return value || fallback;
  }

  private async getCachedNumber(key: string): Promise<number | null> {
    const raw = await this.getSetting(key, '');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private async getCachedDate(key: string): Promise<Date | null> {
    const raw = await this.getSetting(key, '');
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
