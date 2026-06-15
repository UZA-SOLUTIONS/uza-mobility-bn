import type { PrismaClient, SellerType } from '@prisma/client';

const DEFAULT_RULES: Array<{
  sellerType: SellerType;
  originCountry?: string;
  shippingCostUsd?: number;
  localChargesUsd?: number;
  taxRatePercent?: number;
  insuranceRatePercent?: number;
  storagePerDayUsd?: number;
  clearingFeeUsd?: number;
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
    shippingCostUsd: 2500,
    localChargesUsd: 800,
    taxRatePercent: 18,
    insuranceRatePercent: 1.5,
    storagePerDayUsd: 25,
    clearingFeeUsd: 450,
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
    shippingCostUsd: 1800,
    localChargesUsd: 600,
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
