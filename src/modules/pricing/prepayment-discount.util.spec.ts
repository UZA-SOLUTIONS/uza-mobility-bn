import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  annualisedCostPercent,
  discountPercentFor,
  MAX_DISCOUNT_PERCENT,
  MIN_PREPAYMENT_PERCENT,
  quotePrepayment,
} from './prepayment-discount.util';

describe('the published ladder', () => {
  // These four are what a client is told. If one changes, it must be because somebody
  // decided to change the offer — not because a rounding rule moved underneath it.
  it.each([
    [100, 10],
    [75, 7.5],
    [50, 5],
    [40, 4],
  ])('%i%% prepaid earns %s%% off', (prepaid, expected) => {
    expect(discountPercentFor(prepaid)).toBe(expected);
  });

  it('earns nothing below the floor, and says so rather than erroring', () => {
    // Asking about 20% is a legitimate question. The answer is "no discount", not a 400.
    expect(discountPercentFor(39)).toBe(0);
    expect(discountPercentFor(20)).toBe(0);
    expect(discountPercentFor(0)).toBe(0);
  });

  it('turns on exactly at the floor', () => {
    expect(discountPercentFor(MIN_PREPAYMENT_PERCENT - 0.01)).toBe(0);
    expect(discountPercentFor(MIN_PREPAYMENT_PERCENT)).toBe(4);
  });

  it('is continuous between the published points', () => {
    // The reason it is a formula and not a table: a client at 74% must not get the same
    // as one at 51%, or they will ask why, and the honest answer is "no reason".
    expect(discountPercentFor(60)).toBe(6);
    expect(discountPercentFor(74)).toBe(7.4);
    expect(discountPercentFor(90)).toBe(9);
  });

  it('never exceeds the cap, whatever a future rule does', () => {
    expect(discountPercentFor(100)).toBeLessThanOrEqual(MAX_DISCOUNT_PERCENT);
  });

  it('rejects an impossible percentage', () => {
    expect(() => discountPercentFor(101)).toThrow(BadRequestException);
    expect(() => discountPercentFor(-1)).toThrow(BadRequestException);
    expect(() => discountPercentFor(Number.NaN)).toThrow(BadRequestException);
  });
});

describe('quoting a prepayment', () => {
  const PRICE = 21_000_00; // RWF 21,000.00 in minor units

  it('discounts the whole price, then takes the prepayment share of the DISCOUNTED price', () => {
    // Order matters and it is worth pinning. A client paying 50% pays half of the
    // discounted price. Applying the share first and discounting after would quietly give
    // a smaller benefit than the headline promises.
    const q = quotePrepayment(PRICE, 50);
    expect(q.discountPercent).toBe(5);
    expect(q.discountAmount).toBe(105_000); // 5% of 2,100,000
    expect(q.netPriceAfterDiscount).toBe(1_995_000);
    expect(q.amountDueNow).toBe(997_500); // half of the discounted price
  });

  it('at 100% the amount due now is the whole discounted price', () => {
    const q = quotePrepayment(PRICE, 100);
    expect(q.discountPercent).toBe(10);
    expect(q.amountDueNow).toBe(q.netPriceAfterDiscount);
    expect(q.netPriceAfterDiscount).toBe(1_890_000);
  });

  it('below the floor there is no discount and the client simply pays their share', () => {
    const q = quotePrepayment(PRICE, 30);
    expect(q.discountPercent).toBe(0);
    expect(q.discountAmount).toBe(0);
    expect(q.netPriceAfterDiscount).toBe(PRICE);
    expect(q.amountDueNow).toBe(630_000);
  });

  it('returns whole minor units — never a fraction of a franc', () => {
    // 7.5% of an odd price is not a whole number. Money must not carry a fraction into a
    // ledger or an invoice.
    const q = quotePrepayment(1_999_999, 75);
    for (const v of [
      q.discountAmount,
      q.netPriceAfterDiscount,
      q.amountDueNow,
    ]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('never lets the discount exceed the price', () => {
    const q = quotePrepayment(100, 100);
    expect(q.discountAmount).toBeLessThanOrEqual(100);
    expect(q.netPriceAfterDiscount).toBeGreaterThanOrEqual(0);
  });

  it('handles a zero price without dividing by anything', () => {
    const q = quotePrepayment(0, 100);
    expect(q.discountAmount).toBe(0);
    expect(q.amountDueNow).toBe(0);
  });

  it('rejects a price that is not whole minor units', () => {
    // A float price is how a rounding error reaches an invoice.
    expect(() => quotePrepayment(1234.5, 50)).toThrow(BadRequestException);
    expect(() => quotePrepayment(-1, 50)).toThrow(BadRequestException);
  });
});

describe('what the discount costs UZA', () => {
  it('prices 10% over four months as roughly 30% a year', () => {
    // The number that decides whether this ladder is good business. A discount does not
    // look like borrowing, and it is.
    expect(Math.round(annualisedCostPercent(10, 120))).toBe(30);
  });

  it('costs more the sooner the vehicle arrives', () => {
    // Same discount, less time holding the money — a worse deal for UZA, not a better one.
    expect(annualisedCostPercent(10, 60)).toBeGreaterThan(
      annualisedCostPercent(10, 120),
    );
  });

  it('refuses a nonsensical delivery window rather than returning Infinity', () => {
    expect(() => annualisedCostPercent(10, 0)).toThrow(BadRequestException);
  });
});
