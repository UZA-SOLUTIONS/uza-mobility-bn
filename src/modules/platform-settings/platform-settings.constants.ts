export const PLATFORM_SETTING_KEYS = {
  bookingFeeUsd: 'bookingFeeUsd',
  companyLegalName: 'companyLegalName',
  companyBankName: 'companyBankName',
  companyAccountNumber: 'companyAccountNumber',
  companyWhatsappNumber: 'companyWhatsappNumber',
} as const;

export type PlatformSettingKey =
  (typeof PLATFORM_SETTING_KEYS)[keyof typeof PLATFORM_SETTING_KEYS];

/** Seeded defaults — admin can change these in the dashboard. */
export const DEFAULT_PLATFORM_SETTINGS: Record<PlatformSettingKey, string> = {
  bookingFeeUsd: '500',
  companyLegalName: 'UZA Solutions Ltd',
  companyBankName: 'Your Bank Name',
  companyAccountNumber: '0000000000',
  companyWhatsappNumber: '250788000000',
};

export const DEFAULT_BOOKING_FEE_USD = Number(
  DEFAULT_PLATFORM_SETTINGS.bookingFeeUsd,
);

export type PlatformSettingsSnapshot = {
  bookingFeeUsd: number;
  companyLegalName: string;
  companyBankName: string;
  companyAccountNumber: string;
  companyWhatsappNumber: string;
  currency: 'USD';
};

export type CompanyPaymentDetails = {
  legalName: string;
  bankName: string;
  accountNumber: string;
  whatsappNumber: string;
};
