import { Injectable, NotFoundException } from '@nestjs/common';
import type { PricingRule, SellerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import type { PriceBreakdown, PricingInput } from './pricing.types';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllRules() {
    return this.prisma.pricingRule.findMany({
      orderBy: [{ sellerType: 'asc' }, { originCountry: 'desc' }],
    });
  }

  async createRule(dto: CreatePricingRuleDto) {
    return this.prisma.pricingRule.create({ data: dto });
  }

  async updateRule(id: string, dto: UpdatePricingRuleDto) {
    await this.getRuleOrThrow(id);
    return this.prisma.pricingRule.update({ where: { id }, data: dto });
  }

  async deactivateRule(id: string) {
    await this.getRuleOrThrow(id);
    return this.prisma.pricingRule.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async calculateFromDto(dto: CalculatePriceDto): Promise<PriceBreakdown> {
    return this.calculatePrice(
      dto.sellerType,
      {
        basePriceUsd: dto.basePriceUsd,
        fobPriceUsd: dto.fobPriceUsd,
        sellerDesiredPayoutUsd: dto.sellerDesiredPayoutUsd,
        discountUsd: dto.discountUsd,
      },
      dto.originCountry,
    );
  }

  async calculatePrice(
    sellerType: SellerType,
    input: PricingInput,
    originCountry?: string,
  ): Promise<PriceBreakdown> {
    const rule = await this.getActiveRule(sellerType, originCountry);

    switch (sellerType) {
      case 'UZA_RWANDA_STOCK':
        return this.calcRwandaStock(input, rule);
      case 'UZA_CHINA_SOURCING':
        return this.calcChinaSourcing(input, rule);
      case 'LOCAL_SELLER':
        return this.calcLocalSeller(input, rule);
      case 'INTERNATIONAL_SELLER':
        return this.calcInternational(input, rule);
      default:
        throw new NotFoundException(`Unsupported seller type: ${sellerType}`);
    }
  }

  private calcRwandaStock(
    input: PricingInput,
    rule: PricingRule,
  ): PriceBreakdown {
    const base = input.basePriceUsd ?? 0;
    const discount = input.discountUsd ?? 0;
    const final = base - discount;
    const rate = rule.exchangeRateRwf ?? 1300;

    return {
      sellerType: 'UZA_RWANDA_STOCK',
      basePriceUsd: base,
      discountUsd: discount,
      finalPriceUsd: final,
      finalPriceRwf: final * rate,
      deliveryDaysMin: rule.deliveryDaysMin ?? 1,
      deliveryDaysMax: rule.deliveryDaysMax ?? 2,
      currency: 'USD',
    };
  }

  private calcChinaSourcing(
    input: PricingInput,
    rule: PricingRule,
  ): PriceBreakdown {
    const fob = input.fobPriceUsd ?? 0;
    const ship = rule.shippingCostUsd ?? 0;
    const local = rule.localChargesUsd ?? 0;
    const taxes = (fob + ship) * ((rule.taxRatePercent ?? 0) / 100);
    const insure = (fob + ship) * ((rule.insuranceRatePercent ?? 0) / 100);
    const storage = rule.storagePerDayUsd ?? 0;
    const clearing = rule.clearingFeeUsd ?? 0;
    const landing = fob + ship + local + taxes + insure + storage + clearing;
    const margin = landing * ((rule.platformMarginPercent ?? 0) / 100);
    const discount = input.discountUsd ?? 0;
    const final = landing + margin - discount;
    const rate = rule.exchangeRateRwf ?? 1300;

    return {
      sellerType: 'UZA_CHINA_SOURCING',
      fobPriceUsd: fob,
      shippingCostUsd: ship,
      localChargesUsd: local,
      taxesEstimateUsd: taxes,
      insuranceUsd: insure,
      storageUsd: storage,
      clearingFeeUsd: clearing,
      landingCostUsd: landing,
      marginUsd: margin,
      discountUsd: discount,
      finalPriceUsd: final,
      finalPriceRwf: final * rate,
      deliveryDaysMin: rule.deliveryDaysMin ?? 42,
      deliveryDaysMax: rule.deliveryDaysMax ?? 56,
      currency: 'USD',
    };
  }

  private calcLocalSeller(
    input: PricingInput,
    rule: PricingRule,
  ): PriceBreakdown {
    const payout = input.sellerDesiredPayoutUsd ?? 0;
    const rate = rule.commissionRate ?? 0.05;
    const finalPrice = payout / (1 - rate);
    const commission = finalPrice - payout;
    const discount = input.discountUsd ?? 0;
    const final = finalPrice - discount;
    const rwfRate = rule.exchangeRateRwf ?? 1300;

    return {
      sellerType: 'LOCAL_SELLER',
      sellerDesiredPayoutUsd: payout,
      commissionUsd: commission,
      discountUsd: discount,
      finalPriceUsd: final,
      finalPriceRwf: final * rwfRate,
      deliveryDaysMin: rule.deliveryDaysMin ?? 2,
      deliveryDaysMax: rule.deliveryDaysMax ?? 5,
      currency: 'USD',
    };
  }

  private calcInternational(
    input: PricingInput,
    rule: PricingRule,
  ): PriceBreakdown {
    const fob = input.fobPriceUsd ?? 0;
    const route = rule.shippingCostUsd ?? 0;
    const local = rule.localChargesUsd ?? 0;
    const taxes = (fob + route) * ((rule.taxRatePercent ?? 0) / 100);
    const margin =
      (fob + route + local + taxes) * ((rule.platformMarginPercent ?? 0) / 100);
    const discount = input.discountUsd ?? 0;
    const final = fob + route + local + taxes + margin - discount;
    const rwfRate = rule.exchangeRateRwf ?? 1300;

    return {
      sellerType: 'INTERNATIONAL_SELLER',
      fobPriceUsd: fob,
      shippingCostUsd: route,
      localChargesUsd: local,
      taxesEstimateUsd: taxes,
      marginUsd: margin,
      discountUsd: discount,
      finalPriceUsd: final,
      finalPriceRwf: final * rwfRate,
      deliveryDaysMin: rule.deliveryDaysMin ?? 42,
      deliveryDaysMax: rule.deliveryDaysMax ?? 70,
      currency: 'USD',
    };
  }

  /** Exchange rate locked at invoice time (USD → RWF). */
  async getExchangeRateRwf(
    sellerType: SellerType,
    originCountry?: string,
  ): Promise<number> {
    const rule = await this.getActiveRule(sellerType, originCountry);
    return rule.exchangeRateRwf ?? 1300;
  }

  private async getActiveRule(
    sellerType: SellerType,
    originCountry?: string,
  ): Promise<PricingRule> {
    const now = new Date();

    const rule = await this.prisma.pricingRule.findFirst({
      where: {
        sellerType,
        isActive: true,
        validFrom: { lte: now },
        AND: [
          {
            OR: [
              { originCountry: originCountry ?? null },
              { originCountry: null },
            ],
          },
          {
            OR: [{ validUntil: null }, { validUntil: { gte: now } }],
          },
        ],
      },
      orderBy: { originCountry: 'desc' },
    });

    if (!rule) {
      throw new NotFoundException(
        `No active pricing rule for seller type ${sellerType}`,
      );
    }

    return rule;
  }

  private async getRuleOrThrow(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }
    return rule;
  }
}
