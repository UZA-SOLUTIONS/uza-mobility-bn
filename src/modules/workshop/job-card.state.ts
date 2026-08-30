import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * The job card, and the gates that make a workshop a certified service centre rather than a
 * garage with a computer.
 *
 * Benchmarked against what main-dealer and Bosch Car Service networks actually enforce. Four
 * of their rules do almost all of the work, and each is a gate below:
 *
 *   1. NO WORK WITHOUT WRITTEN AUTHORISATION, and additional work needs a NEW one.
 *      The single biggest destroyer of trust in vehicle repair is a bill larger than the
 *      quote. A gate is the only thing that reliably prevents it.
 *
 *   2. QUALITY CONTROL BY SOMEBODY ELSE. The technician who did the work cannot sign it off.
 *      This is the clearest line between a high-end centre and everyone else, and it costs
 *      nothing but discipline.
 *
 *   3. HIGH-VOLTAGE WORK BY A NAMED, CERTIFIED PERSON. A traction pack can kill. Competence
 *      is per person and per expiry date, never per job title.
 *
 *   4. NOTHING LEAVES UNCHECKED. Handover requires a passed QC, and a road test where the
 *      work touched brakes, steering or suspension.
 *
 * The state machine is explicit rather than a set of booleans because a vehicle is a physical
 * object in one place at one time, and "in progress AND awaiting authorisation" is not a
 * state a workshop can be in.
 */

export const JOB_STATES = [
  'BOOKED',
  /** Vehicle physically received, walk-around done WITH the customer, damage recorded. */
  'RECEIVED',
  'DIAGNOSING',
  /** Findings priced. Nothing may be touched yet. */
  'ESTIMATED',
  'AWAITING_AUTHORISATION',
  'AUTHORISED',
  'IN_PROGRESS',
  /** Something was found mid-job. Work STOPS until the customer authorises again. */
  'ADDITIONAL_WORK_FOUND',
  'AWAITING_PARTS',
  'WORK_COMPLETE',
  /** Checked by somebody other than whoever did the work. */
  'QUALITY_CHECK',
  'ROAD_TEST',
  'READY_FOR_HANDOVER',
  'HANDED_OVER',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
] as const;

export type JobState = (typeof JOB_STATES)[number];

/** Where a job may go from here. Anything not listed is not a transition. */
const TRANSITIONS: Record<JobState, readonly JobState[]> = {
  BOOKED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['DIAGNOSING', 'CANCELLED'],
  DIAGNOSING: ['ESTIMATED', 'CANCELLED'],
  ESTIMATED: ['AWAITING_AUTHORISATION', 'CANCELLED'],
  AWAITING_AUTHORISATION: ['AUTHORISED', 'DECLINED'],
  AUTHORISED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['ADDITIONAL_WORK_FOUND', 'AWAITING_PARTS', 'WORK_COMPLETE'],
  // Additional work re-enters the SAME authorisation gate. There is no path that skips it.
  ADDITIONAL_WORK_FOUND: ['AWAITING_AUTHORISATION'],
  AWAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  WORK_COMPLETE: ['QUALITY_CHECK'],
  // QC may send it back. That is the point of QC.
  QUALITY_CHECK: ['ROAD_TEST', 'READY_FOR_HANDOVER', 'IN_PROGRESS'],
  ROAD_TEST: ['READY_FOR_HANDOVER', 'IN_PROGRESS'],
  READY_FOR_HANDOVER: ['HANDED_OVER'],
  HANDED_OVER: ['CLOSED'],
  CLOSED: [],
  DECLINED: ['CLOSED'],
  CANCELLED: [],
};

export const isTerminal = (s: JobState): boolean => TRANSITIONS[s].length === 0;

/** Work that must not be signed off without a road test. */
export const SAFETY_CRITICAL = [
  'BRAKES',
  'STEERING',
  'SUSPENSION',
  'TYRES',
] as const;
export type WorkCategory =
  (typeof SAFETY_CRITICAL)[number] | 'HIGH_VOLTAGE' | 'BODY' | 'GENERAL';

export interface TechnicianCompetence {
  technicianId: string;
  /** Categories this person is signed off to work on, by name. */
  certifiedFor: readonly WorkCategory[];
  /** Certification expiry. An expired certificate is not a certificate. */
  certifiedUntil: Date;
}

export interface TransitionContext {
  from: JobState;
  to: JobState;
  /** Set when the customer has authorised the CURRENT scope, including any additions. */
  authorisedAt?: Date | null;
  /** Whoever performed the work. */
  performedByTechnicianId?: string | null;
  /** Whoever is signing the quality check. Must differ from the above. */
  checkedByTechnicianId?: string | null;
  qualityCheckPassed?: boolean;
  roadTestCompleted?: boolean;
  categories?: readonly WorkCategory[];
  competence?: TechnicianCompetence;
  now?: Date;
}

/**
 * Decide whether a transition is allowed, and refuse with a reason a service advisor can
 * read out to a customer.
 *
 * Throws rather than returning false: every one of these is a rule the workshop must not be
 * able to proceed past by ignoring a return value.
 */
export function assertTransition(ctx: TransitionContext): void {
  const { from, to } = ctx;
  const now = ctx.now ?? new Date();

  if (!TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(`A job cannot go from ${from} to ${to}.`);
  }

  // GATE 1 — no work without a current authorisation.
  //
  // Applies when work STARTS or RESUMES, not when a job comes back from QC or a road test.
  // Rework to correct the workshop's own defect is inside the scope the customer already
  // authorised and is done at the workshop's cost — asking them to authorise it again would
  // imply they are paying for it twice. A first version of this gate fired on every entry to
  // IN_PROGRESS and blocked exactly that, which a test caught.
  const isRework = from === 'QUALITY_CHECK' || from === 'ROAD_TEST';
  if (to === 'IN_PROGRESS' && !isRework && !ctx.authorisedAt) {
    throw new ForbiddenException(
      'Work cannot start until the customer has authorised this scope in writing.',
    );
  }

  // GATE 3 — high-voltage work needs a named, unexpired certificate.
  if (to === 'IN_PROGRESS' && ctx.categories?.includes('HIGH_VOLTAGE')) {
    const c = ctx.competence;
    if (!c || c.technicianId !== ctx.performedByTechnicianId) {
      throw new ForbiddenException(
        'High-voltage work requires the certificate of the technician actually performing it.',
      );
    }
    if (!c.certifiedFor.includes('HIGH_VOLTAGE')) {
      throw new ForbiddenException(
        'This technician is not certified for high-voltage work.',
      );
    }
    if (c.certifiedUntil.getTime() <= now.getTime()) {
      throw new ForbiddenException(
        'This technician’s high-voltage certification has expired.',
      );
    }
  }

  // GATE 2 — quality control is somebody else's signature.
  if (to === 'QUALITY_CHECK' || to === 'READY_FOR_HANDOVER') {
    if (
      ctx.checkedByTechnicianId &&
      ctx.checkedByTechnicianId === ctx.performedByTechnicianId
    ) {
      throw new ForbiddenException(
        'The quality check must be signed by somebody other than the technician who did the work.',
      );
    }
  }

  // GATE 4 — nothing leaves unchecked.
  if (to === 'READY_FOR_HANDOVER') {
    if (!ctx.qualityCheckPassed) {
      throw new ForbiddenException('The quality check has not been passed.');
    }
    const touchedSafety = (ctx.categories ?? []).some((c) =>
      (SAFETY_CRITICAL as readonly string[]).includes(c),
    );
    if (touchedSafety && !ctx.roadTestCompleted) {
      throw new ForbiddenException(
        'Work touched brakes, steering, suspension or tyres — a road test is required.',
      );
    }
  }
}

/**
 * Does this job need a fresh authorisation?
 *
 * True whenever the priced scope has grown beyond what the customer agreed. A tolerance is
 * deliberately NOT offered: "we assumed you would not mind a little extra" is exactly the
 * habit this prevents.
 */
export function needsReauthorisation(
  authorisedTotalMinor: number,
  currentTotalMinor: number,
): boolean {
  if (
    !Number.isInteger(authorisedTotalMinor) ||
    !Number.isInteger(currentTotalMinor)
  ) {
    throw new BadRequestException('Totals must be integer minor units.');
  }
  return currentTotalMinor > authorisedTotalMinor;
}
