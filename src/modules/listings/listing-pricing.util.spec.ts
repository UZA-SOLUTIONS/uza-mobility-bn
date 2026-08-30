import { BadRequestException } from '@nestjs/common';
import { SellerType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertListingPricingInput,
  toPricingInput,
} from './listing-pricing.util';

/**
 * The reference test for this repository. Copy its shape.
 *
 * It targets pure functions with no database, so it runs in milliseconds and fails for
 * exactly one reason. Where a service needs Prisma, mock the client rather than reaching
 * for a real one — see app.controller.spec.ts.
 */

describe('which price a listing must carry', () => {
  // Each seller type is priced from a different starting point, and the wrong one silently
  // produces a listing nobody can transact against.
  const cases: [SellerType, keyof ReturnType<typeof toPricingInput>][] = [
    [SellerType.UZA_RWANDA_STOCK, 'basePriceUsd'],
    [SellerType.UZA_CHINA_SOURCING, 'fobPriceUsd'],
    [SellerType.INTERNATIONAL_SELLER, 'fobPriceUsd'],
    [SellerType.LOCAL_SELLER, 'sellerDesiredPayoutUsd'],
  ];

  it.each(cases)('%s requires %s', (sellerType, required) => {
    expect(() =>
      assertListingPricingInput(sellerType, { [required]: 1000 }),
    ).not.toThrow();

    expect(() => assertListingPricingInput(sellerType, {})).toThrow(
      BadRequestException,
    );
  });

  it('names the missing field, so the seller can fix it without guessing', () => {
    // A 400 that says "invalid input" makes somebody read the source to find out what is
    // wrong. This one tells them.
    expect(() =>
      assertListingPricingInput(SellerType.LOCAL_SELLER, {}),
    ).toThrow(/sellerDesiredPayoutUsd/);
    expect(() =>
      assertListingPricingInput(SellerType.UZA_RWANDA_STOCK, {}),
    ).toThrow(/basePriceUsd/);
  });

  it('does not accept another seller type’s price instead', () => {
    // A local seller supplying a FOB price is the mistake this guards: it would look
    // populated and price the vehicle from the wrong basis.
    expect(() =>
      assertListingPricingInput(SellerType.LOCAL_SELLER, { fobPriceUsd: 9000 }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertListingPricingInput(SellerType.UZA_RWANDA_STOCK, {
        fobPriceUsd: 9000,
      }),
    ).toThrow(BadRequestException);
  });

  it('treats zero as a supplied price, not a missing one', () => {
    // `== null` is deliberate rather than falsy: a genuinely zero price is a business
    // decision (a giveaway, a correction), and rejecting it as "missing" would be wrong.
    expect(() =>
      assertListingPricingInput(SellerType.UZA_RWANDA_STOCK, {
        basePriceUsd: 0,
      }),
    ).not.toThrow();
  });

  it('rejects a seller type it does not know', () => {
    // Adding a SellerType to the schema without adding it here must fail loudly rather
    // than let an unpriced listing through.
    expect(() =>
      assertListingPricingInput('SOMETHING_NEW' as SellerType, {
        basePriceUsd: 1,
      }),
    ).toThrow(/Unsupported seller type/);
  });
});

describe('toPricingInput', () => {
  it('carries every price field through unchanged', () => {
    const dto = {
      basePriceUsd: 21_000,
      fobPriceUsd: 18_000,
      sellerDesiredPayoutUsd: 17_000,
      discountUsd: 500,
      pricingRuleId: 'rule-1',
    };
    expect(toPricingInput(dto)).toEqual({
      basePriceUsd: 21_000,
      fobPriceUsd: 18_000,
      sellerDesiredPayoutUsd: 17_000,
      discountUsd: 500,
    });
  });

  it('drops pricingRuleId, which is not part of the calculation input', () => {
    expect(
      toPricingInput({ basePriceUsd: 1, pricingRuleId: 'rule-1' }),
    ).not.toHaveProperty('pricingRuleId');
  });
});
