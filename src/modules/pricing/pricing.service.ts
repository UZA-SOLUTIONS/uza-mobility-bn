import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ListingPricing, PricingRule, SellerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rwfToUsdAmount } from '../../common/money/money-format.util';
import { ExchangeRateService } from '../platform-settings/exchange-rate.service';
import {
  breakdownToListingPricingCreate,
  parsePricingRuleIdFromPriceNotes,
  toPricingInput,
} from '../listings/listing-pricing.util';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import type { PriceBreakdown, PricingInput } from './pricing.types';
import { applyRuleAndListingDiscounts } from './pricing-discount.util';

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

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
    const updated = await this.prisma.pricingRule.update({
      where: { id },
      data: dto,
    });
    const listingsSynced = await this.syncListingsForPricingRule(id);
    if (listingsSynced > 0) {
      this.logger.log(
        `Synced pricing for ${listingsSynced} listing(s) after rule ${id} update`,
      );
    }
    return updated;
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
        basePriceRwf: dto.basePriceRwf,
        fobPriceRwf: dto.fobPriceRwf,
        sellerDesiredPayoutRwf: dto.sellerDesiredPayoutRwf,
        discountRwf: dto.discountRwf,
      },
      dto.originCountry,
      dto.pricingRuleId,
    );
  }

  async calculatePrice(
    sellerType: SellerType,
    input: PricingInput,
    originCountry?: string,
    pricingRuleId?: string,
    frozenRate?: number,
  ): Promise<PriceBreakdown> {
    const rate =
      frozenRate ?? (await this.exchangeRateService.getFrozenRate());
    const rule = pricingRuleId
      ? await this.getRuleOrThrow(pricingRuleId)
      : await this.getActiveRule(sellerType, originCountry);

    switch (sellerType) {
      case 'UZA_RWANDA_STOCK':
        return this.calcRwandaStock(input, rule, rate);
      case 'UZA_CHINA_SOURCING':
        return this.calcChinaSourcing(input, rule, rate);
      case 'LOCAL_SELLER':
        return this.calcLocalSeller(input, rule, rate);
      case 'INTERNATIONAL_SELLER':
        return this.calcInternational(input, rule, rate);
      default:
        throw new NotFoundException(`Unsupported seller type: ${sellerType}`);
    }
  }

  private finalize(
    sellerType: SellerType,
    fields: Omit<
      PriceBreakdown,
      'currency' | 'sellerType' | 'finalPriceUsd' | 'displayPriceRwf'
    >,
    rate: number,
  ): PriceBreakdown {
    const finalPriceRwf = Math.round(fields.finalPriceRwf);
    return {
      ...fields,
      sellerType,
      finalPriceRwf,
      displayPriceRwf: finalPriceRwf,
      finalPriceUsd: rwfToUsdAmount(finalPriceRwf, rate),
      currency: 'RWF',
    };
  }

  private calcRwandaStock(
    input: PricingInput,
    rule: PricingRule,
    rate: number,
  ): PriceBreakdown {
    const base = input.basePriceRwf ?? 0;
    const discounts = applyRuleAndListingDiscounts(
      base,
      rule,
      input.discountRwf,
    );
    return this.finalize(
      'UZA_RWANDA_STOCK',
      {
        basePriceRwf: base,
        ruleDiscountRwf: discounts.ruleDiscount,
        ruleDiscountRatePercent: discounts.ruleDiscountRatePercent,
        discountRwf: discounts.discount,
        finalPriceRwf: discounts.finalPrice,
        deliveryDaysMin: rule.deliveryDaysMin ?? 1,
        deliveryDaysMax: rule.deliveryDaysMax ?? 2,
      },
      rate,
    );
  }

  private calcChinaSourcing(
    input: PricingInput,
    rule: PricingRule,
    rate: number,
  ): PriceBreakdown {
    const fob = input.fobPriceRwf ?? 0;
    const ship = rule.shippingCostRwf ?? 0;
    const local = rule.localChargesRwf ?? 0;
    const taxes = (fob + ship) * ((rule.taxRatePercent ?? 0) / 100);
    const insure = (fob + ship) * ((rule.insuranceRatePercent ?? 0) / 100);
    const storage = rule.storagePerDayRwf ?? 0;
    const clearing = rule.clearingFeeRwf ?? 0;
    const landing = fob + ship + local + taxes + insure + storage + clearing;
    const margin = landing * ((rule.platformMarginPercent ?? 0) / 100);
    const preDiscount = landing + margin;
    const discounts = applyRuleAndListingDiscounts(
      preDiscount,
      rule,
      input.discountRwf,
    );
    return this.finalize(
      'UZA_CHINA_SOURCING',
      {
        fobPriceRwf: fob,
        shippingCostRwf: ship,
        localChargesRwf: local,
        taxesEstimateRwf: taxes,
        insuranceRwf: insure,
        storageRwf: storage,
        clearingFeeRwf: clearing,
        landingCostRwf: landing,
        marginRwf: margin,
        platformMarginRatePercent: rule.platformMarginPercent ?? undefined,
        ruleDiscountRwf: discounts.ruleDiscount,
        ruleDiscountRatePercent: discounts.ruleDiscountRatePercent,
        discountRwf: discounts.discount,
        finalPriceRwf: discounts.finalPrice,
        deliveryDaysMin: rule.deliveryDaysMin ?? 42,
        deliveryDaysMax: rule.deliveryDaysMax ?? 56,
      },
      rate,
    );
  }

  private calcLocalSeller(
    input: PricingInput,
    rule: PricingRule,
    rate: number,
  ): PriceBreakdown {
    const payout = input.sellerDesiredPayoutRwf ?? 0;
    const commissionRate = rule.commissionRate ?? 0.05;
    const finalPrice = payout / (1 - commissionRate);
    const commission = finalPrice - payout;
    const discounts = applyRuleAndListingDiscounts(
      finalPrice,
      rule,
      input.discountRwf,
    );
    return this.finalize(
      'LOCAL_SELLER',
      {
        sellerDesiredPayoutRwf: payout,
        commissionRwf: commission,
        ruleDiscountRwf: discounts.ruleDiscount,
        ruleDiscountRatePercent: discounts.ruleDiscountRatePercent,
        discountRwf: discounts.discount,
        finalPriceRwf: discounts.finalPrice,
        deliveryDaysMin: rule.deliveryDaysMin ?? 2,
        deliveryDaysMax: rule.deliveryDaysMax ?? 5,
      },
      rate,
    );
  }

  private calcInternational(
    input: PricingInput,
    rule: PricingRule,
    rate: number,
  ): PriceBreakdown {
    const fob = input.fobPriceRwf ?? 0;
    const route = rule.shippingCostRwf ?? 0;
    const local = rule.localChargesRwf ?? 0;
    const taxes = (fob + route) * ((rule.taxRatePercent ?? 0) / 100);
    const margin =
      (fob + route + local + taxes) *
      ((rule.platformMarginPercent ?? 0) / 100);
    const preDiscount = fob + route + local + taxes + margin;
    const discounts = applyRuleAndListingDiscounts(
      preDiscount,
      rule,
      input.discountRwf,
    );
    return this.finalize(
      'INTERNATIONAL_SELLER',
      {
        fobPriceRwf: fob,
        shippingCostRwf: route,
        localChargesRwf: local,
        taxesEstimateRwf: taxes,
        marginRwf: margin,
        platformMarginRatePercent: rule.platformMarginPercent ?? undefined,
        ruleDiscountRwf: discounts.ruleDiscount,
        ruleDiscountRatePercent: discounts.ruleDiscountRatePercent,
        discountRwf: discounts.discount,
        finalPriceRwf: discounts.finalPrice,
        deliveryDaysMin: rule.deliveryDaysMin ?? 42,
        deliveryDaysMax: rule.deliveryDaysMax ?? 70,
      },
      rate,
    );
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

  private async syncListingsForPricingRule(
    pricingRuleId: string,
  ): Promise<number> {
    const rule = await this.getRuleOrThrow(pricingRuleId);

    const listings = await this.prisma.listing.findMany({
      where: {
        sellerType: rule.sellerType,
        listingPricing: { isNot: null },
      },
      include: { listingPricing: true },
    });

    const activeRuleIdByCountry = new Map<string, string>();
    let synced = 0;

    for (const listing of listings) {
      const pricing = listing.listingPricing;
      if (!pricing) continue;
      if (pricing.currency !== 'RWF') continue;

      const linkedRuleId = parsePricingRuleIdFromPriceNotes(pricing.priceNotes);
      let applies = linkedRuleId === pricingRuleId;

      if (!applies && !linkedRuleId) {
        const countryKey = listing.country ?? '';
        let activeRuleId = activeRuleIdByCountry.get(countryKey);
        if (activeRuleId === undefined) {
          try {
            const activeRule = await this.getActiveRule(
              listing.sellerType,
              listing.country ?? undefined,
            );
            activeRuleId = activeRule.id;
          } catch {
            activeRuleId = '';
          }
          activeRuleIdByCountry.set(countryKey, activeRuleId);
        }
        applies = activeRuleId === pricingRuleId;
      }

      if (!applies) continue;

      await this.recalculateListingPricing(
        listing,
        pricing,
        linkedRuleId ?? pricingRuleId,
      );
      synced += 1;
    }

    return synced;
  }

  private async recalculateListingPricing(
    listing: {
      id: string;
      sellerType: SellerType;
      country: string | null;
    },
    pricing: ListingPricing,
    pricingRuleId: string,
  ): Promise<void> {
    const breakdown = await this.calculatePrice(
      listing.sellerType,
      toPricingInput({
        basePriceRwf: pricing.basePriceRwf ?? undefined,
        fobPriceRwf: pricing.fobPriceRwf ?? undefined,
        sellerDesiredPayoutRwf: pricing.sellerDesiredPayoutRwf ?? undefined,
        discountRwf: pricing.discountRwf ?? undefined,
      }),
      listing.country ?? undefined,
      pricingRuleId,
    );

    const pricingData = breakdownToListingPricingCreate(
      breakdown,
      pricingRuleId,
      pricing,
    );

    await this.prisma.$transaction([
      this.prisma.listingPricing.update({
        where: { listingId: listing.id },
        data: pricingData,
      }),
      this.prisma.listing.update({
        where: { id: listing.id },
        data: { deliveryEstimateDays: breakdown.deliveryDaysMax },
      }),
    ]);
  }
}
