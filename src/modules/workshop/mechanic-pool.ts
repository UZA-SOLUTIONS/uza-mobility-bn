import { BadRequestException } from '@nestjs/common';
import type { WorkCategory } from './job-card.state';

/**
 * The mechanic pool: who is in the network, what they are allowed to touch, and how they
 * progress.
 *
 * The business runs two arms deliberately, and this file is what keeps them apart in code:
 *
 *   EMPLOYED    UZA employees in the UZA workshop. UZA sets the price, carries the
 *               employment obligations, and stands behind the work without qualification.
 *               Everything UZA has warranted to a lender happens here.
 *
 *   CERTIFIED   Independent garages and individual mechanics, on their own premises, with
 *               their own tools and their own tax position. UZA certifies the work and
 *               supplies the standard and the job card; it does not employ the person.
 *
 * ── THE TRAP THIS FILE EXISTS TO AVOID ────────────────────────────────────────────────
 *
 * If UZA sets an independent's price, schedules their day, and pays them per job, that is
 * an employment relationship wearing a commercial contract, whatever the paperwork says. It
 * is the same misclassification risk as engaging the head of maintenance's four technicians
 * through him rather than directly.
 *
 * So `CERTIFIED` partners set their own price and UZA takes a commission; `EMPLOYED`
 * technicians work to a price UZA sets. `assertPricingAllowed` refuses the combination that
 * blurs it, because a rule nobody can breach is worth more than a clause nobody reads.
 */

export type Engagement = 'EMPLOYED' | 'CERTIFIED';

/**
 * Progression. Deliberately short — four levels people can name, not a matrix nobody
 * remembers. What each may touch is `certifiedFor`, per person; the level is seniority, and
 * the two are independent on purpose. A skilled apprentice may hold an HV certificate; a
 * master technician who let theirs lapse may not touch a pack.
 */
export type Level = 'APPRENTICE' | 'TECHNICIAN' | 'SENIOR' | 'MASTER';

const LEVEL_ORDER: Record<Level, number> = {
  APPRENTICE: 0,
  TECHNICIAN: 1,
  SENIOR: 2,
  MASTER: 3,
};

export interface Mechanic {
  mechanicId: string;
  /** The UZA ID. One person, one identifier, across the estate. */
  uzaId: string;
  engagement: Engagement;
  level: Level;
  certifiedFor: readonly WorkCategory[];
  certifiedUntil: Date;
  /** Set when certification is withdrawn. A suspended partner is not dispatchable. */
  suspendedAt?: Date | null;
}

/** An apprentice must be supervised, and by somebody senior enough to be responsible. */
export const MIN_SUPERVISOR_LEVEL: Level = 'SENIOR';

export function isCertificationCurrent(m: Mechanic, now = new Date()): boolean {
  return !m.suspendedAt && m.certifiedUntil.getTime() > now.getTime();
}

/**
 * May this person do this category of work unsupervised?
 *
 * An apprentice never may — that is what apprentice means. Everyone else needs a current
 * certificate naming the category.
 */
export function mayWorkUnsupervised(
  m: Mechanic,
  category: WorkCategory,
  now = new Date(),
): boolean {
  if (m.level === 'APPRENTICE') return false;
  return isCertificationCurrent(m, now) && m.certifiedFor.includes(category);
}

/**
 * Can `supervisor` sign for `apprentice` on this category?
 *
 * The supervisor must be senior enough AND certified for the very thing being supervised.
 * Supervising work you are not certified for is not supervision, it is company.
 */
export function maySupervise(
  supervisor: Mechanic,
  category: WorkCategory,
  now = new Date(),
): boolean {
  return (
    LEVEL_ORDER[supervisor.level] >= LEVEL_ORDER[MIN_SUPERVISOR_LEVEL] &&
    mayWorkUnsupervised(supervisor, category, now)
  );
}

/**
 * Who sets the price for this job.
 *
 * Throws on the combination that creates the misclassification risk: UZA pricing an
 * independent partner's labour. The partner sets their price; UZA earns a commission.
 */
export function assertPricingAllowed(
  m: Mechanic,
  pricedBy: 'UZA' | 'MECHANIC',
): void {
  if (m.engagement === 'CERTIFIED' && pricedBy === 'UZA') {
    throw new BadRequestException(
      'A certified independent sets their own price; UZA takes a commission. ' +
        'Pricing their labour would make this an employment relationship in substance.',
    );
  }
  if (m.engagement === 'EMPLOYED' && pricedBy === 'MECHANIC') {
    throw new BadRequestException(
      'An employed technician works to the price UZA sets.',
    );
  }
}

/**
 * Who may be offered this job.
 *
 * `restrictToEmployed` is how the lender warranty is honoured: anything UZA has promised a
 * bank about a financed vehicle — battery health, HV work, the inspection product — is done
 * by UZA's own people in UZA's own workshop, not by a partner UZA merely certifies.
 */
export function eligibleForJob(
  pool: readonly Mechanic[],
  opts: { category: WorkCategory; restrictToEmployed?: boolean; now?: Date },
): Mechanic[] {
  const now = opts.now ?? new Date();
  return pool.filter(
    (m) =>
      (!opts.restrictToEmployed || m.engagement === 'EMPLOYED') &&
      mayWorkUnsupervised(m, opts.category, now),
  );
}

/**
 * Certificates expiring within `days`, soonest first.
 *
 * Renewal is scheduled from this, and the reason it matters is that an expired certificate
 * silently removes somebody from every eligibility check above. A technician who cannot be
 * dispatched and does not know why is a rota problem that looks like a software bug.
 */
export function expiringSoon(
  pool: readonly Mechanic[],
  days: number,
  now = new Date(),
): Mechanic[] {
  if (!Number.isFinite(days) || days < 0) {
    throw new BadRequestException('days must be a non-negative number');
  }
  const cutoff = now.getTime() + days * 86_400_000;
  return pool
    .filter((m) => !m.suspendedAt)
    .filter((m) => m.certifiedUntil.getTime() > now.getTime())
    .filter((m) => m.certifiedUntil.getTime() <= cutoff)
    .sort((a, b) => a.certifiedUntil.getTime() - b.certifiedUntil.getTime());
}
