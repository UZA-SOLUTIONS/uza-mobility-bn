export const PLATFORM_SETTING_KEYS = {
  bookingFeeUsd: 'bookingFeeUsd',
  bookingFeeRwf: 'bookingFeeRwf',
  companyLegalName: 'companyLegalName',
  companyBankName: 'companyBankName',
  companyAccountNumber: 'companyAccountNumber',
  companyBankNameRwf: 'companyBankNameRwf',
  companyAccountNumberRwf: 'companyAccountNumberRwf',
  companyWhatsappNumber: 'companyWhatsappNumber',
  rwfMarkupPercent: 'rwfMarkupPercent',
  usdToRwfApi: 'usdToRwfApi',
  usdToRwfEffective: 'usdToRwfEffective',
  rateFetchedAt: 'rateFetchedAt',
} as const;

export type PlatformSettingKey =
  (typeof PLATFORM_SETTING_KEYS)[keyof typeof PLATFORM_SETTING_KEYS];

export const DEFAULT_FROZEN_USD_TO_RWF = 1472.8279;

/** Seeded defaults — admin can change these in the dashboard. */
export const DEFAULT_PLATFORM_SETTINGS: Record<PlatformSettingKey, string> = {
  bookingFeeUsd: '500',
  bookingFeeRwf: String(Math.round(500 * DEFAULT_FROZEN_USD_TO_RWF)),
  companyLegalName: 'UZA Solutions Ltd',
  companyBankName: 'Your Bank Name',
  companyAccountNumber: '0000000000',
  companyBankNameRwf: 'Your Bank Name',
  companyAccountNumberRwf: '0000000000',
  companyWhatsappNumber: '250788000000',
  rwfMarkupPercent: '2',
  usdToRwfApi: '',
  usdToRwfEffective: String(DEFAULT_FROZEN_USD_TO_RWF),
  rateFetchedAt: '',
};

export const DEFAULT_BOOKING_FEE_USD = Number(
  DEFAULT_PLATFORM_SETTINGS.bookingFeeUsd,
);

export const DEFAULT_BOOKING_FEE_RWF = Number(
  DEFAULT_PLATFORM_SETTINGS.bookingFeeRwf,
);

export const DEFAULT_RWF_MARKUP_PERCENT = Number(
  DEFAULT_PLATFORM_SETTINGS.rwfMarkupPercent,
);

export type ExchangeRateSnapshot = {
  usdToRwfApi: number;
  usdToRwfEffective: number;
  markupPercent: number;
  rateFetchedAt: string | null;
  baseCurrency: 'USDT';
  quoteCurrency: 'RWF';
  frozen: true;
};

export type PlatformSettingsSnapshot = {
  bookingFeeUsd: number;
  bookingFeeRwf: number;
  companyLegalName: string;
  companyBankName: string;
  companyAccountNumber: string;
  companyBankNameRwf: string;
  companyAccountNumberRwf: string;
  companyWhatsappNumber: string;
  currency: 'RWF';
  rwfMarkupPercent: number;
  exchangeRate: ExchangeRateSnapshot;
};

export type CompanyBankAccount = {
  bankName: string;
  accountNumber: string;
};

export type CompanyPaymentDetails = {
  legalName: string;
  whatsappNumber: string;
  usd: CompanyBankAccount;
  rwf: CompanyBankAccount;
};

export type PaymentSettlementCurrency = 'USD' | 'RWF';
