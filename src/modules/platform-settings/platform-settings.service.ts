import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import {
  DEFAULT_BOOKING_FEE_USD,
  DEFAULT_PLATFORM_SETTINGS,
  PLATFORM_SETTING_KEYS,
  type CompanyPaymentDetails,
  type PlatformSettingKey,
  type PlatformSettingsSnapshot,
} from './platform-settings.constants';

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getDefault(key: PlatformSettingKey): string {
    return DEFAULT_PLATFORM_SETTINGS[key];
  }

  async getString(key: PlatformSettingKey): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key },
    });
    const value = row?.value?.trim();
    return value || this.getDefault(key);
  }

  async getBookingFeeUsd(): Promise<number> {
    const raw = await this.getString(PLATFORM_SETTING_KEYS.bookingFeeUsd);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_BOOKING_FEE_USD;
  }

  async getCompanyPaymentDetails(): Promise<CompanyPaymentDetails> {
    const [legalName, bankName, accountNumber] = await Promise.all([
      this.getString(PLATFORM_SETTING_KEYS.companyLegalName),
      this.getString(PLATFORM_SETTING_KEYS.companyBankName),
      this.getString(PLATFORM_SETTING_KEYS.companyAccountNumber),
    ]);

    return { legalName, bankName, accountNumber };
  }

  async getSettings(): Promise<PlatformSettingsSnapshot> {
    const bookingFeeUsd = await this.getBookingFeeUsd();
    const company = await this.getCompanyPaymentDetails();

    return {
      bookingFeeUsd,
      companyLegalName: company.legalName,
      companyBankName: company.bankName,
      companyAccountNumber: company.accountNumber,
      currency: 'USD',
    };
  }

  async updateSettings(
    adminId: string,
    dto: UpdatePlatformSettingsDto,
    auditContext: RequestAuditContext = {},
  ): Promise<PlatformSettingsSnapshot> {
    const updates: Array<{ key: PlatformSettingKey; value: string }> = [];

    if (dto.bookingFeeUsd != null) {
      updates.push({
        key: PLATFORM_SETTING_KEYS.bookingFeeUsd,
        value: String(dto.bookingFeeUsd),
      });
    }
    if (dto.companyLegalName != null) {
      updates.push({
        key: PLATFORM_SETTING_KEYS.companyLegalName,
        value: dto.companyLegalName.trim(),
      });
    }
    if (dto.companyBankName != null) {
      updates.push({
        key: PLATFORM_SETTING_KEYS.companyBankName,
        value: dto.companyBankName.trim(),
      });
    }
    if (dto.companyAccountNumber != null) {
      updates.push({
        key: PLATFORM_SETTING_KEYS.companyAccountNumber,
        value: dto.companyAccountNumber.trim(),
      });
    }

    if (updates.length === 0) {
      return this.getSettings();
    }

    await this.prisma.$transaction(
      updates.map(({ key, value }) =>
        this.prisma.platformSetting.upsert({
          where: { key },
          create: { key, value, updatedBy: adminId },
          update: { value, updatedBy: adminId },
        }),
      ),
    );

    await this.auditService.record({
      userId: adminId,
      action: 'platform-settings:updated',
      entity: 'PlatformSetting',
      entityId: 'platform-settings',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: Object.fromEntries(
        updates.map(({ key, value }) => [key, value]),
      ),
    });

    return this.getSettings();
  }
}
