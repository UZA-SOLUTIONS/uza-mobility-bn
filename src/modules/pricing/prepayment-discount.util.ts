import { BadRequestException } from '@nestjs/common';

/**
 * Prepayment discount: the client pays for a vehicle still in China, and the earlier and
 * larger the payment, the larger the discount.
 *
 *   100% paid -> 10.0% off        50% paid -> 5.0% off
 *    75% paid ->  7.5% off        40% paid -> 4.0% off
 *
 * One rule rather than a table of tiers: **discount = prepayment ÷ 10**, linear, with a
 * floor below which nothing is earned. A table invites a client at 74% to ask why they get
 * the same as one at 51%, and invites staff to add tiers until nobody can say what the
 * policy is.
 *
 * WHAT THIS COSTS UZA, because a discount does not look like borrowing and is
 *
 * Paying 100% up front against delivery roughly four months later earns 10%. That is
 * UZA borrowing the vehicle's price for a third of a year at 10%, or about **30% a year**.
 * That is expensive working capital, and the number should be compared against what a bank
 * would charge before the ladder is treated as free money. It may still be worth it — it
 * removes cancellation risk, credit risk and the financing cost of the order — but it is a
 * financing decision, not a marketing one.
 *
 * `annualisedCostPercent()` exists so that trade-off is visible in the same place as the
 * discount, rather than discovered later in a margin review.
 */

/** Below this, no discount is earned. Set here so the policy has exactly one home. */
export const MIN_PREPAYMENT_PERCENT = 40;

/** discount = prepayment ÷ DIVISOR. 100 -> 10, 75 -> 7.5, 40 -> 4. */
const DIVISOR = 10;

/** The most UZA will ever give, whatever a future rule change does. A hard stop. */
export const MAX_DISCOUNT_PERCENT = 10;

export interface PrepaymentQuote {
  prepaymentPercent: number;
  discountPercent: number;
  /** Discount in the same minor units as the price passed in. */
  discountAmount: number;
  /** What the client pays in total, after the discount. */
  netPriceAfterDiscount: number;
  /** What must clear before the discount is honoured. See the note on cleared funds. */
  amountDueNow: number;
}

/**
 * The discount earned by prepaying `prepaymentPercent` of the price.
 *
 * Returns 0 below the floor rather than throwing: a client asking about 20% is asking a
 * legitimate question and should be told "no discount", not shown an error.
 */
export function discountPercentFor(prepaymentPercent: number): number {
  assertPercent(prepaymentPercent, 'prepaymentPercent');
  if (prepaymentPercent < MIN_PREPAYMENT_PERCENT) return 0;
  return Math.min(prepaymentPercent / DIVISOR, MAX_DISCOUNT_PERCENT);
}

/**
 * Price a prepayment offer.
 *
 * `priceMinor` is in MINOR units (cents) and every amount returned is too. Money is never
 * a float here: 0.1 + 0.2 is not 0.3, and a rounding error on a vehicle is not a rounding
 * error a client will accept.
 *
 * Rounding favours the CLIENT on the discount (round half up) and the discount is applied
 * to the whole price before the prepayment share is taken — so a client paying 50% pays
 * half of the *discounted* price, not half of the list price. Doing it the other way round
 * quietly gives a smaller benefit than the headline promises, and somebody eventually
 * notices.
 */
export function quotePrepayment(
  priceMinor: number,
  prepaymentPercent: number,
): PrepaymentQuote {
  if (!Number.isInteger(priceMinor) || priceMinor < 0) {
    throw new BadRequestException('priceMinor must be a non-negative integer of minor units');
  }
  const discountPercent = discountPercentFor(prepaymentPercent);

  const discountAmount = Math.round((priceMinor * discountPercent) / 100);
  const netPriceAfterDiscount = priceMinor - discountAmount;
  const amountDueNow = Math.round((netPriceAfterDiscount * prepaymentPercent) / 100);

  return {
    prepaymentPercent,
    discountPercent,
    discountAmount,
    netPriceAfterDiscount,
    amountDueNow,
  };
}

/**
 * What the discount costs UZA as an annual rate, given how long the money is held.
 *
 * Not decoration. A 10% discount for a vehicle delivered in four months is ~30% a year, and
 * that belongs next to the discount whenever anyone is deciding whether to widen the ladder.
 */
export function annualisedCostPercent(
  discountPercent: number,
  daysUntilDelivery: number,
): number {
  if (daysUntilDelivery <= 0) {
    throw new BadRequestException('daysUntilDelivery must be positive');
  }
  return (discountPercent * 365) / daysUntilDelivery;
}

function assertPercent(v: number, name: string): void {
  if (!Number.isFinite(v) || v < 0 || v > 100) {
    throw new BadRequestException(`${name} must be between 0 and 100`);
  }
}
