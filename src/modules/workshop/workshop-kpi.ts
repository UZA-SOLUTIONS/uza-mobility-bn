import { BadRequestException } from '@nestjs/common';
import type { WorkCategory } from './job-card.state';

/**
 * What the workshop is measured on.
 *
 * These five are taken directly from the heads of agreement, and the reason they are these
 * five and not the obvious ones is written there:
 *
 *   > Do not pay him per job, per hour billed, or on workshop revenue.
 *   >
 *   > A garage paid on volume has a standing incentive to find work that was not there, and
 *   > UZA's entire lender proposition rests on maintenance records being honest. The moment a
 *   > bank suspects the service history is inflated, the uptime commitment and the battery
 *   > certificate are both worthless.
 *
 * So there is deliberately **no jobs-per-day, no revenue-per-technician and no hours-billed**
 * in this file. Every metric below improves by doing the work properly, and none improves by
 * doing more of it. That is the whole test for whether a metric belongs here.
 *
 * `comebackRate` is the one to watch. It is the only metric that gets *worse* when work is
 * rushed, so it is the counterweight to every pressure to turn cars around faster.
 */

export interface CompletedJob {
  jobRef: string;
  vin: string;
  categories: readonly WorkCategory[];
  promisedAt: Date;
  handedOverAt: Date;
  receivedAt: Date;
  /** True when this job needed rework after failing its own quality check. */
  failedQualityCheck: boolean;
  /** Recorded incidents. Any high-voltage incident is a reportable event, not a statistic. */
  safetyIncidents: number;
}

export interface WorkshopKpis {
  jobsCompleted: number;
  /** Finished right the first time: no QC failure, and no comeback within the window. */
  firstTimeFixRate: number;
  /** Same vehicle, same category, back within the window. Should be near zero. */
  comebackRate: number;
  /** Handed over by the time promised. */
  onTimeDeliveryRate: number;
  /** Received to handed over, in hours. */
  medianTurnaroundHours: number;
  safetyIncidents: number;
}

/** A return inside this window is a comeback, not a new fault. */
export const COMEBACK_WINDOW_DAYS = 30;

/**
 * Compute the period's KPIs.
 *
 * Rates are returned as fractions (0–1) rather than percentages, so the caller decides how
 * to render them and nobody multiplies by 100 twice.
 *
 * An empty period returns zeroes rather than NaN. A month with no jobs is a real thing —
 * a workshop that has just opened — and it must not put NaN on a manager's screen.
 */
export function computeKpis(jobs: readonly CompletedJob[]): WorkshopKpis {
  const n = jobs.length;
  if (n === 0) {
    return {
      jobsCompleted: 0,
      firstTimeFixRate: 0,
      comebackRate: 0,
      onTimeDeliveryRate: 0,
      medianTurnaroundHours: 0,
      safetyIncidents: 0,
    };
  }

  const comebacks = findComebacks(jobs);
  const comebackRefs = new Set(comebacks.map((c) => c.jobRef));

  const firstTime = jobs.filter(
    (j) => !j.failedQualityCheck && !comebackRefs.has(j.jobRef),
  ).length;
  const onTime = jobs.filter(
    (j) => j.handedOverAt.getTime() <= j.promisedAt.getTime(),
  ).length;

  return {
    jobsCompleted: n,
    firstTimeFixRate: firstTime / n,
    comebackRate: comebacks.length / n,
    onTimeDeliveryRate: onTime / n,
    medianTurnaroundHours: median(
      jobs.map(
        (j) => (j.handedOverAt.getTime() - j.receivedAt.getTime()) / 3_600_000,
      ),
    ),
    safetyIncidents: jobs.reduce((s, j) => s + j.safetyIncidents, 0),
  };
}

/**
 * Jobs that came back: same VIN, an overlapping work category, within the window.
 *
 * The FIRST visit is the comeback, not the second. That is deliberate and it is the whole
 * point of the metric — it says *that job was not finished*, which is a statement about the
 * work done then, not about the customer returning now. Counting the second visit would
 * measure how often customers come back, which is a different and much less useful number.
 */
export function findComebacks(
  jobs: readonly CompletedJob[],
  windowDays = COMEBACK_WINDOW_DAYS,
): CompletedJob[] {
  if (!Number.isFinite(windowDays) || windowDays <= 0) {
    throw new BadRequestException('windowDays must be positive');
  }
  const windowMs = windowDays * 86_400_000;
  const byVin = new Map<string, CompletedJob[]>();
  for (const j of jobs) {
    byVin.set(j.vin, [...(byVin.get(j.vin) ?? []), j]);
  }

  const out: CompletedJob[] = [];
  for (const visits of byVin.values()) {
    const ordered = [...visits].sort(
      (a, b) => a.handedOverAt.getTime() - b.handedOverAt.getTime(),
    );
    for (let i = 0; i < ordered.length - 1; i++) {
      const first = ordered[i];
      const next = ordered[i + 1];
      const gap = next.receivedAt.getTime() - first.handedOverAt.getTime();
      const overlaps = next.categories.some((c) =>
        first.categories.includes(c),
      );
      if (gap >= 0 && gap <= windowMs && overlaps) out.push(first);
    }
  }
  return out;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Is this set of KPIs acceptable?
 *
 * Thresholds are conservative and belong to the business rather than the code — they are
 * arguments, not constants of nature. They live here so there is one place to change them
 * and one place to read them, and `reasons` says which one failed so a review is a
 * conversation rather than a red light.
 */
export const KPI_TARGETS = {
  firstTimeFixRate: 0.9,
  comebackRate: 0.05,
  onTimeDeliveryRate: 0.9,
} as const;

export function reviewKpis(k: WorkshopKpis): {
  meetsTargets: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (k.firstTimeFixRate < KPI_TARGETS.firstTimeFixRate) {
    reasons.push(
      `First-time fix ${pct(k.firstTimeFixRate)} is below ${pct(KPI_TARGETS.firstTimeFixRate)}.`,
    );
  }
  if (k.comebackRate > KPI_TARGETS.comebackRate) {
    reasons.push(
      `Comebacks ${pct(k.comebackRate)} exceed ${pct(KPI_TARGETS.comebackRate)} — work is being rushed.`,
    );
  }
  if (k.onTimeDeliveryRate < KPI_TARGETS.onTimeDeliveryRate) {
    reasons.push(
      `On-time delivery ${pct(k.onTimeDeliveryRate)} is below ${pct(KPI_TARGETS.onTimeDeliveryRate)}.`,
    );
  }
  // Not a rate and not averaged. One is one too many, and it is a conversation that day.
  if (k.safetyIncidents > 0) {
    reasons.push(
      `${k.safetyIncidents} safety incident(s) — review each one individually.`,
    );
  }
  return { meetsTargets: reasons.length === 0, reasons };
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;
