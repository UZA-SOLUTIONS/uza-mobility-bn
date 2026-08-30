import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  computeKpis,
  findComebacks,
  KPI_TARGETS,
  reviewKpis,
  type CompletedJob,
} from './workshop-kpi';

const day = (d: number, h = 9) => new Date(Date.UTC(2026, 7, d, h));

const done = (
  over: Partial<CompletedJob> & Pick<CompletedJob, 'jobRef'>,
): CompletedJob => ({
  vin: 'VIN-1',
  categories: ['GENERAL'],
  receivedAt: day(1, 8),
  promisedAt: day(1, 17),
  handedOverAt: day(1, 16),
  failedQualityCheck: false,
  safetyIncidents: 0,
  ...over,
});

describe('an empty period', () => {
  it('returns zeroes, never NaN', () => {
    // A month with no jobs is a real thing — a workshop that just opened — and it must not
    // put NaN on a manager's screen.
    const k = computeKpis([]);
    expect(k.jobsCompleted).toBe(0);
    for (const v of Object.values(k)) expect(Number.isNaN(v)).toBe(false);
  });
});

describe('on-time delivery', () => {
  it('counts handover at or before the promise as on time', () => {
    const k = computeKpis([
      done({ jobRef: 'early', handedOverAt: day(1, 15) }),
      done({ jobRef: 'exact', handedOverAt: day(1, 17) }),
      done({ jobRef: 'late', handedOverAt: day(1, 18) }),
    ]);
    expect(k.onTimeDeliveryRate).toBeCloseTo(2 / 3);
  });
});

describe('comebacks — the metric that gets worse when work is rushed', () => {
  it('flags the FIRST visit, not the second', () => {
    // The point of the metric: it says "that job was not finished", which is a statement
    // about the work done then. Counting the second visit would measure how often customers
    // return, which is a different and much less useful number.
    const first = done({ jobRef: 'first', handedOverAt: day(1, 16) });
    const second = done({
      jobRef: 'second',
      receivedAt: day(10, 8),
      handedOverAt: day(10, 16),
    });
    const back = findComebacks([first, second]);
    expect(back.map((j) => j.jobRef)).toEqual(['first']);
  });

  it('does not count a return for DIFFERENT work', () => {
    // Coming back for brakes after a service is a new job, not a failure of the service.
    const a = done({
      jobRef: 'service',
      categories: ['GENERAL'],
      handedOverAt: day(1, 16),
    });
    const b = done({
      jobRef: 'brakes',
      categories: ['BRAKES'],
      receivedAt: day(5, 8),
      handedOverAt: day(5, 16),
    });
    expect(findComebacks([a, b])).toEqual([]);
  });

  it('does not count a return outside the window', () => {
    const a = done({ jobRef: 'a', handedOverAt: day(1, 16) });
    const b = done({
      jobRef: 'b',
      receivedAt: day(25, 8),
      handedOverAt: day(25, 16),
    });
    expect(findComebacks([a, b], 10)).toEqual([]);
    expect(findComebacks([a, b], 30).map((j) => j.jobRef)).toEqual(['a']);
  });

  it('keeps different vehicles separate', () => {
    const a = done({ jobRef: 'a', vin: 'VIN-1', handedOverAt: day(1, 16) });
    const b = done({
      jobRef: 'b',
      vin: 'VIN-2',
      receivedAt: day(2, 8),
      handedOverAt: day(2, 16),
    });
    expect(findComebacks([a, b])).toEqual([]);
  });

  it('rejects a nonsensical window', () => {
    expect(() => findComebacks([], 0)).toThrow(BadRequestException);
  });
});

describe('first-time fix', () => {
  it('excludes a job that failed its own quality check', () => {
    const k = computeKpis([
      done({ jobRef: 'clean' }),
      done({ jobRef: 'reworked', vin: 'VIN-9', failedQualityCheck: true }),
    ]);
    expect(k.firstTimeFixRate).toBe(0.5);
  });

  it('excludes a job that came back, even though its own QC passed', () => {
    // QC passing and the fault recurring are different failures. Both mean it was not
    // finished first time.
    const first = done({ jobRef: 'first', handedOverAt: day(1, 16) });
    const second = done({
      jobRef: 'second',
      receivedAt: day(5, 8),
      handedOverAt: day(5, 16),
    });
    const k = computeKpis([first, second]);
    expect(k.firstTimeFixRate).toBe(0.5);
    expect(k.comebackRate).toBe(0.5);
  });
});

describe('turnaround', () => {
  it('reports the MEDIAN, so one recovery job does not distort the month', () => {
    const k = computeKpis([
      done({ jobRef: '1', receivedAt: day(1, 8), handedOverAt: day(1, 10) }), // 2h
      done({
        jobRef: '2',
        vin: 'V2',
        receivedAt: day(1, 8),
        handedOverAt: day(1, 12),
      }), // 4h
      done({
        jobRef: '3',
        vin: 'V3',
        receivedAt: day(1, 8),
        handedOverAt: day(20, 8),
      }), // 456h
    ]);
    expect(k.medianTurnaroundHours).toBe(4);
  });
});

describe('what this file deliberately does NOT measure', () => {
  it('has no volume metric anywhere in the result', () => {
    // From the heads of agreement: "Do not pay him per job, per hour billed, or on workshop
    // revenue. A garage paid on volume has a standing incentive to find work that was not
    // there." Every metric here improves by doing the work properly; none improves by doing
    // more of it. jobsCompleted is a denominator, not a target.
    const keys = Object.keys(computeKpis([done({ jobRef: 'x' })]));
    for (const forbidden of [
      'revenue',
      'hoursBilled',
      'jobsPerDay',
      'utilisation',
    ]) {
      expect(
        keys.some((k) => k.toLowerCase().includes(forbidden.toLowerCase())),
      ).toBe(false);
    }
  });
});

describe('the review', () => {
  const good = computeKpis([
    done({ jobRef: 'a' }),
    done({ jobRef: 'b', vin: 'V2' }),
  ]);

  it('passes a clean month', () => {
    expect(reviewKpis(good).meetsTargets).toBe(true);
    expect(reviewKpis(good).reasons).toEqual([]);
  });

  it('names which target failed, so a review is a conversation', () => {
    const bad = { ...good, comebackRate: 0.4, onTimeDeliveryRate: 0.5 };
    const r = reviewKpis(bad);
    expect(r.meetsTargets).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/Comebacks/);
    expect(r.reasons.join(' ')).toMatch(/rushed/);
    expect(r.reasons.join(' ')).toMatch(/On-time/);
  });

  it('fails the month on a single safety incident, and does not average it', () => {
    // One is one too many, and it is a conversation that day.
    const r = reviewKpis({ ...good, safetyIncidents: 1 });
    expect(r.meetsTargets).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/safety incident/i);
  });

  it('keeps the targets in one place', () => {
    expect(KPI_TARGETS.comebackRate).toBeLessThan(0.1);
    expect(KPI_TARGETS.firstTimeFixRate).toBeGreaterThan(0.8);
  });
});
