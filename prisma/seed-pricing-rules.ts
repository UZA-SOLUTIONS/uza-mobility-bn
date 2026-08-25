import type { PrismaClient, SellerType } from '@prisma/client';

const DEFAULT_RULES: Array<{
  sellerType: SellerType;
  originCountry?: string;
  shippingCostRwf?: number;
  localChargesRwf?: number;
  taxRatePercent?: number;
  insuranceRatePercent?: number;
  storagePerDayRwf?: number;
  clearingFeeRwf?: number;
  platformMarginPercent?: number;
  commissionRate?: number;
  deliveryDaysMin?: number;
  deliveryDaysMax?: number;
}> = [
  {
    sellerType: 'UZA_RWANDA_STOCK',
    deliveryDaysMin: 1,
    deliveryDaysMax: 4,
  },
  {
    sellerType: 'UZA_CHINA_SOURCING',
    shippingCostRwf: 3_682_070,
    localChargesRwf: 1_178_262,
    taxRatePercent: 18,
    insuranceRatePercent: 1.5,
    storagePerDayRwf: 36_821,
    clearingFeeRwf: 662_773,
    platformMarginPercent: 12,
    deliveryDaysMin: 45,
    deliveryDaysMax: 60,
  },
  {
    sellerType: 'LOCAL_SELLER',
    commissionRate: 0.05,
    deliveryDaysMin: 2,
    deliveryDaysMax: 5,
  },
  {
    sellerType: 'INTERNATIONAL_SELLER',
    shippingCostRwf: 2_651_090,
    localChargesRwf: 883_697,
    taxRatePercent: 15,
    platformMarginPercent: 10,
    deliveryDaysMin: 42,
    deliveryDaysMax: 70,
  },
];

export async function seedPricingRules(prisma: PrismaClient) {
  for (const rule of DEFAULT_RULES) {
    const existing = await prisma.pricingRule.findFirst({
      where: {
        sellerType: rule.sellerType,
        originCountry: rule.originCountry ?? null,
        isActive: true,
      },
    });

    if (!existing) {
      await prisma.pricingRule.create({ data: rule });
    }
  }
}
