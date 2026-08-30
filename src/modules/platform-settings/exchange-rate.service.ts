import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_RWF_MARKUP_PERCENT,
  PLATFORM_SETTING_KEYS,
  type ExchangeRateSnapshot,
} from './platform-settings.constants';

type ExchangeRateApiResponse = {
  result?: string;
  conversion_rates?: Record<string, number>;
  time_last_update_utc?: string;
  time_next_update_unix?: number;
};

const STALE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

  async getSnapshot(options?: {
    refreshIfStale?: boolean;
  }): Promise<ExchangeRateSnapshot> {
    const refreshIfStale = options?.refreshIfStale !== false;
    let apiRate = await this.getCachedNumber(PLATFORM_SETTING_KEYS.usdToRwfApi);
    let effective = await this.getCachedNumber(
      PLATFORM_SETTING_KEYS.usdToRwfEffective,
    );
    const fetchedAt = await this.getCachedDate(
      PLATFORM_SETTING_KEYS.rateFetchedAt,
    );
    const markupPercent = await this.getMarkupPercent();

    const isStale =
      !apiRate ||
      !effective ||
      !fetchedAt ||
      Date.now() - fetchedAt.getTime() > STALE_MS;

    if (refreshIfStale && isStale) {
      try {
        const refreshed = await this.refreshFromApi();
        return refreshed;
      } catch (error) {
        this.logger.warn(
          `Exchange rate refresh failed, using cache if available: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (!apiRate || !effective) {
          throw error;
        }
      }
    }

    if (!apiRate || !effective) {
      // Last resort defaults so admin/public UI can still render
      apiRate = apiRate ?? 1472.8279;
      effective = effective ?? apiRate * (1 + markupPercent / 100);
    }

    return {
      usdToRwfApi: apiRate,
      usdToRwfEffective: effective,
      markupPercent,
      rateFetchedAt: fetchedAt?.toISOString() ?? null,
      baseCurrency: 'USDT',
      quoteCurrency: 'RWF',
    };
  }

  async refreshFromApi(adminId?: string): Promise<ExchangeRateSnapshot> {
    const apiKey = this.config.get<string>('EXCHANGE_RATE_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'EXCHANGE_RATE_API_KEY is not configured',
      );
    }

    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Exchange rate API returned ${response.status}`,
      );
    }

    const body = (await response.json()) as ExchangeRateApiResponse;
    if (body.result !== 'success' || body.conversion_rates?.RWF == null) {
      throw new ServiceUnavailableException(
        'Exchange rate API response missing RWF rate',
      );
    }

    const apiRate = Number(body.conversion_rates.RWF);
    if (!Number.isFinite(apiRate) || apiRate <= 0) {
      throw new ServiceUnavailableException('Invalid RWF rate from API');
    }

    const markupPercent = await this.getMarkupPercent();
    const effective = apiRate * (1 + markupPercent / 100);
    const fetchedAt = new Date().toISOString();

    await this.prisma.$transaction([
      this.upsertSetting(
        PLATFORM_SETTING_KEYS.usdToRwfApi,
        String(apiRate),
        adminId,
      ),
      this.upsertSetting(
        PLATFORM_SETTING_KEYS.usdToRwfEffective,
        String(effective),
        adminId,
      ),
      this.upsertSetting(
        PLATFORM_SETTING_KEYS.rateFetchedAt,
        fetchedAt,
        adminId,
      ),
    ]);

    return {
      usdToRwfApi: apiRate,
      usdToRwfEffective: effective,
      markupPercent,
      rateFetchedAt: fetchedAt,
      baseCurrency: 'USDT',
      quoteCurrency: 'RWF',
    };
  }

  async recomputeEffective(adminId?: string): Promise<ExchangeRateSnapshot> {
    const markupPercent = await this.getMarkupPercent();
    const apiRate =
      (await this.getCachedNumber(PLATFORM_SETTING_KEYS.usdToRwfApi)) ??
      1472.8279;
    const effective = apiRate * (1 + markupPercent / 100);
    const fetchedAt =
      (await this.getSetting(PLATFORM_SETTING_KEYS.rateFetchedAt, '')) ||
      new Date().toISOString();

    await this.upsertSetting(
      PLATFORM_SETTING_KEYS.usdToRwfEffective,
      String(effective),
      adminId,
    );

    return {
      usdToRwfApi: apiRate,
      usdToRwfEffective: effective,
      markupPercent,
      rateFetchedAt: fetchedAt,
      baseCurrency: 'USDT',
      quoteCurrency: 'RWF',
    };
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
