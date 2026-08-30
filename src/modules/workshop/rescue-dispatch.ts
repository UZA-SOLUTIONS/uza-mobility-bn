import { BadRequestException } from '@nestjs/common';
import { SAFETY_CRITICAL, type WorkCategory } from './job-card.state';

/**
 * Roadside rescue: who is sent, and why that one.
 *
 * The strategy is asset-light — a breakdown is attended by the NEAREST CERTIFIED PARTNER
 * rather than by UZA driving across the city, and the platform earns a referral commission
 * on the job. That is the only version of a rescue promise UZA can make at current scale,
 * and it is a business rather than a cost centre.
 *
 * Which makes dispatch the whole product. Get it wrong and you have sent an uncertified
 * person to a high-voltage incident, or promised forty minutes to somebody who will wait two
 * hours. Both are worse than having no rescue service.
 *
 * ── THE RULE THAT OVERRIDES DISTANCE ──────────────────────────────────────────────────
 *
 * A stranded electric vehicle is not a stranded car with a flat battery. If the fault is
 * high-voltage, only an HV-certified responder may attend — **even if they are an hour
 * further away**. Nearest-wins is the right default and the wrong rule for a traction pack,
 * and a dispatcher under pressure at 9pm should not be the last line of defence.
 */

export interface Responder {
  responderId: string;
  name: string;
  /** Straight-line km from the breakdown. Road distance if you have it; this is a proxy. */
  distanceKm: number;
  certifiedFor: readonly WorkCategory[];
  certifiedUntil: Date;
  /** False when off shift, already on a job, or suspended. */
  available: boolean;
  /** 0–5, from completed rescues. Used only to break a near-tie on distance. */
  rating: number;
  /** Jobs already assigned today. Breaks a tie when distance and rating match. */
  openJobs: number;
}

export interface DispatchRequest {
  category: WorkCategory;
  responders: readonly Responder[];
  /** Beyond this, a responder is not "roadside". Default 25km. */
  maxDistanceKm?: number;
  now?: Date;
}

export interface DispatchResult {
  chosen: Responder;
  /** Everyone eligible, best first — so a dispatcher can override with the next one. */
  alternatives: Responder[];
  reason: string;
}

/** Distances within this are treated as equal, so rating can decide. */
const TIE_KM = 2;
const DEFAULT_MAX_KM = 25;

/**
 * Pick a responder, or explain precisely why nobody can be sent.
 *
 * Returns null rather than throwing when nobody is eligible: "no one is available" is a real
 * operational answer that the caller must handle by telling the customer the truth, not an
 * exception to be logged and swallowed.
 */
export function dispatch(req: DispatchRequest): DispatchResult | null {
  const now = req.now ?? new Date();
  const maxKm = req.maxDistanceKm ?? DEFAULT_MAX_KM;

  if (!Number.isFinite(maxKm) || maxKm <= 0) {
    throw new BadRequestException('maxDistanceKm must be a positive number');
  }

  const eligible = req.responders.filter(
    (r) =>
      r.available &&
      r.distanceKm <= maxKm &&
      r.certifiedUntil.getTime() > now.getTime() &&
      r.certifiedFor.includes(req.category),
  );

  if (eligible.length === 0) return null;

  const ranked = [...eligible].sort(compare);
  const [chosen, ...alternatives] = ranked;

  return {
    chosen: chosen,
    alternatives,
    reason: reasonFor(chosen, req.category),
  };
}

/**
 * Nearest first; within TIE_KM, better rated; then least loaded; then by id so the order is
 * stable rather than dependent on input order.
 *
 * Stability matters more than it looks: an unstable sort makes two dispatchers running the
 * same query see different "best" responders, and neither can explain their screen.
 */
function compare(a: Responder, b: Responder): number {
  if (Math.abs(a.distanceKm - b.distanceKm) > TIE_KM)
    return a.distanceKm - b.distanceKm;
  if (a.rating !== b.rating) return b.rating - a.rating;
  if (a.openJobs !== b.openJobs) return a.openJobs - b.openJobs;
  return a.responderId.localeCompare(b.responderId);
}

function reasonFor(r: Responder, category: WorkCategory): string {
  if (category === 'HIGH_VOLTAGE') {
    return `${r.name} — HV-certified and nearest of those certified (${r.distanceKm}km).`;
  }
  return `${r.name} — nearest available (${r.distanceKm}km).`;
}

/**
 * The referral commission UZA earns on a rescue it routed.
 *
 * Percent of the job value, in integer minor units. The partner invoices the customer; UZA
 * invoices the partner for the referral. **UZA is not in the payment path** — the same rule
 * that governs the wallet, for the same reason.
 */
export function referralCommission(
  jobValueMinor: number,
  ratePercent: number,
): number {
  if (!Number.isInteger(jobValueMinor) || jobValueMinor < 0) {
    throw new BadRequestException(
      'jobValueMinor must be a non-negative integer of minor units',
    );
  }
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new BadRequestException('ratePercent must be between 0 and 100');
  }
  return Math.round((jobValueMinor * ratePercent) / 100);
}

/**
 * Does this fault have to go to a workshop rather than be fixed at the roadside?
 *
 * Safety-critical systems and traction packs are not roadside work. Recovering the vehicle is
 * slower and costs more, and it is the answer.
 */
export function requiresRecovery(category: WorkCategory): boolean {
  return (
    category === 'HIGH_VOLTAGE' ||
    (SAFETY_CRITICAL as readonly string[]).includes(category)
  );
}
