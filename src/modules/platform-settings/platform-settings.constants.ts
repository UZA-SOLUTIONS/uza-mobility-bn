export const PLATFORM_SETTING_KEYS = {
  bookingFeeUsd: 'bookingFeeUsd',
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

/** Seeded defaults — admin can change these in the dashboard. */
export const DEFAULT_PLATFORM_SETTINGS: Record<PlatformSettingKey, string> = {
  bookingFeeUsd: '500',
  companyLegalName: 'UZA Solutions Ltd',
  companyBankName: 'Your Bank Name',
  companyAccountNumber: '0000000000',
  companyBankNameRwf: 'Your Bank Name',
  companyAccountNumberRwf: '0000000000',
  companyWhatsappNumber: '250788000000',
  rwfMarkupPercent: '2',
  usdToRwfApi: '',
  usdToRwfEffective: '',
  rateFetchedAt: '',
};

export const DEFAULT_BOOKING_FEE_USD = Number(
  DEFAULT_PLATFORM_SETTINGS.bookingFeeUsd,
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
};

export type PlatformSettingsSnapshot = {
  bookingFeeUsd: number;
  companyLegalName: string;
  companyBankName: string;
  companyAccountNumber: string;
  companyBankNameRwf: string;
  companyAccountNumberRwf: string;
  companyWhatsappNumber: string;
  currency: 'USDT';
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
