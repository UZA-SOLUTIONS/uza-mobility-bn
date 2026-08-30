import { BadRequestException } from '@nestjs/common';
import type { JobState } from './job-card.state';

/**
 * The workshop board — what a service manager looks at first thing, and what it tells them
 * to do next.
 *
 * A garage that operates professionally is not one with more software. It is one where the
 * manager can answer four questions in ten seconds:
 *
 *   What is late, or about to be?
 *   What is stopped, and who is stopping it?
 *   What is nobody working on?
 *   What did we promise, and can we still keep it?
 *
 * Everything here answers one of those. Capacity optimisation, technician utilisation
 * charts and revenue dashboards are deliberately absent — they need months of real job
 * cards to mean anything, and a workshop that has not opened has none.
 *
 * ── THE ORDERING IS THE PRODUCT ───────────────────────────────────────────────────────
 *
 * A board that lists jobs by arrival time is a list. A board that lists them by what will
 * cost most if ignored is a management system. The ranking below is opinionated on purpose:
 *
 *   1. Already late           the customer is owed a phone call, now
 *   2. Will be late           still recoverable, and only if somebody acts today
 *   3. Awaiting authorisation the vehicle occupies a bay and earns nothing
 *   4. Awaiting parts         blocked, but blocked on somebody outside the workshop
 *   5. Everything else        proceeding
 *
 * Awaiting authorisation ranks above awaiting parts because it is the one the workshop can
 * actually fix — by calling the customer. Blocked-on-us beats blocked-on-them.
 */

export type Attention =
  | 'OVERDUE'
  | 'AT_RISK'
  | 'AWAITING_AUTHORISATION'
  | 'AWAITING_PARTS'
  | 'ON_TRACK';

const RANK: Record<Attention, number> = {
  OVERDUE: 0,
  AT_RISK: 1,
  AWAITING_AUTHORISATION: 2,
  AWAITING_PARTS: 3,
  ON_TRACK: 4,
};

export interface BoardJob {
  jobRef: string;
  vehiclePlate: string;
  state: JobState;
  /** What the customer was told. The promise is the commitment, not an estimate. */
  promisedAt: Date;
  /** Assigned technician, or null when nobody is on it. */
  technicianId: string | null;
}

export interface BoardRow extends BoardJob {
  attention: Attention;
  /** Negative when already past the promise. */
  minutesToPromise: number;
  /** Plain enough for a manager to act on without interpreting a status code. */
  note: string;
}

/** Inside this window a job is at risk rather than on track. */
const AT_RISK_MINUTES = 120;

/** States where the workshop is waiting on somebody else, not working. */
const WAITING: Partial<Record<JobState, Attention>> = {
  AWAITING_AUTHORISATION: 'AWAITING_AUTHORISATION',
  ADDITIONAL_WORK_FOUND: 'AWAITING_AUTHORISATION',
  AWAITING_PARTS: 'AWAITING_PARTS',
};

/** Jobs that have left the workshop's hands and should not clutter the board. */
const OFF_BOARD: readonly JobState[] = [
  'HANDED_OVER',
  'CLOSED',
  'CANCELLED',
  'DECLINED',
];

/**
 * Build the board: the open jobs, most urgent first.
 *
 * Closed and handed-over jobs are dropped rather than greyed out. A board is a list of
 * things to do, and anything that needs no action is noise on it.
 */
export function buildBoard(
  jobs: readonly BoardJob[],
  now = new Date(),
): BoardRow[] {
  return jobs
    .filter((j) => !OFF_BOARD.includes(j.state))
    .map((j) => toRow(j, now))
    .sort(
      (a, b) =>
        RANK[a.attention] - RANK[b.attention] ||
        a.minutesToPromise - b.minutesToPromise ||
        a.jobRef.localeCompare(b.jobRef),
    );
}

function toRow(job: BoardJob, now: Date): BoardRow {
  const minutesToPromise = Math.round(
    (job.promisedAt.getTime() - now.getTime()) / 60_000,
  );
  const waiting = WAITING[job.state];

  // Lateness outranks being blocked. A late job that is also awaiting parts is still late,
  // and the customer still needs telling.
  const attention: Attention =
    minutesToPromise < 0
      ? 'OVERDUE'
      : (waiting ??
        (minutesToPromise <= AT_RISK_MINUTES ? 'AT_RISK' : 'ON_TRACK'));

  return {
    ...job,
    attention,
    minutesToPromise,
    note: noteFor(job, attention, minutesToPromise),
  };
}

function noteFor(job: BoardJob, attention: Attention, mins: number): string {
  switch (attention) {
    case 'OVERDUE':
      return `${-mins} min past the promised time — call the customer.`;
    case 'AT_RISK':
      return `Due in ${mins} min${job.technicianId ? '' : ', and nobody is assigned'}.`;
    case 'AWAITING_AUTHORISATION':
      return 'Waiting on the customer to authorise. Occupying a bay and earning nothing.';
    case 'AWAITING_PARTS':
      return 'Blocked on parts.';
    default:
      return job.technicianId ? 'Proceeding.' : 'Nobody assigned.';
  }
}

/**
 * Jobs in progress with no technician on them.
 *
 * Small, and the one that quietly costs the most: a car sitting in a bay that everybody
 * assumes somebody else is working on.
 */
export function unassigned(rows: readonly BoardRow[]): BoardRow[] {
  return rows.filter(
    (r) => r.technicianId === null && r.state === 'IN_PROGRESS',
  );
}

/**
 * How loaded each technician is right now.
 *
 * Reported as a count of open jobs, not as a utilisation percentage. A percentage needs a
 * defensible denominator — shift length, breaks, standard labour times — and inventing one
 * produces a number that looks precise and means nothing.
 */
export function loadByTechnician(
  rows: readonly BoardRow[],
): Map<string, number> {
  const load = new Map<string, number>();
  for (const r of rows) {
    if (!r.technicianId) continue;
    load.set(r.technicianId, (load.get(r.technicianId) ?? 0) + 1);
  }
  return load;
}

/**
 * Can this bay take another job today?
 *
 * Capacity is bays, not optimism. `bays` is how many vehicles can physically be worked on.
 */
export function hasCapacity(rows: readonly BoardRow[], bays: number): boolean {
  if (!Number.isInteger(bays) || bays <= 0) {
    throw new BadRequestException('bays must be a positive integer');
  }
  const occupying = rows.filter(
    (r) => r.state !== 'BOOKED' && r.state !== 'READY_FOR_HANDOVER',
  ).length;
  return occupying < bays;
}
