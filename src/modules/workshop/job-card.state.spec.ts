import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  isTerminal,
  JOB_STATES,
  needsReauthorisation,
  type JobState,
  type TransitionContext,
} from './job-card.state';

const TECH = 'TECH-1';
const OTHER = 'TECH-2';
const future = new Date('2027-01-01');
const past = new Date('2026-01-01');
const now = new Date('2026-08-29');

const hvCertified = {
  technicianId: TECH,
  certifiedFor: ['HIGH_VOLTAGE'] as const,
  certifiedUntil: future,
};

const go = (over: Partial<TransitionContext> & Pick<TransitionContext, 'from' | 'to'>) =>
  assertTransition({ now, ...over });

describe('the happy path a certified centre actually follows', () => {
  it('walks booking to closed without skipping a stage', () => {
    const path: [JobState, JobState][] = [
      ['BOOKED', 'RECEIVED'],
      ['RECEIVED', 'DIAGNOSING'],
      ['DIAGNOSING', 'ESTIMATED'],
      ['ESTIMATED', 'AWAITING_AUTHORISATION'],
      ['AWAITING_AUTHORISATION', 'AUTHORISED'],
      ['AUTHORISED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'WORK_COMPLETE'],
      ['WORK_COMPLETE', 'QUALITY_CHECK'],
      ['QUALITY_CHECK', 'READY_FOR_HANDOVER'],
      ['READY_FOR_HANDOVER', 'HANDED_OVER'],
      ['HANDED_OVER', 'CLOSED'],
    ];
    for (const [from, to] of path) {
      expect(() =>
        go({
          from,
          to,
          authorisedAt: new Date(),
          performedByTechnicianId: TECH,
          checkedByTechnicianId: OTHER,
          qualityCheckPassed: true,
          categories: ['GENERAL'],
        }),
      ).not.toThrow();
    }
  });

  it('refuses a jump that skips a stage', () => {
    // Received straight to in-progress is how a car gets worked on before anyone priced it.
    expect(() => go({ from: 'RECEIVED', to: 'IN_PROGRESS' })).toThrow(BadRequestException);
    expect(() => go({ from: 'BOOKED', to: 'HANDED_OVER' })).toThrow(BadRequestException);
  });
});

describe('gate 1 — no work without authorisation', () => {
  it('will not start work when nothing has been authorised', () => {
    expect(() => go({ from: 'AUTHORISED', to: 'IN_PROGRESS' })).toThrow(
      /authorised this scope in writing/,
    );
  });

  it('starts once the customer has authorised', () => {
    expect(() =>
      go({ from: 'AUTHORISED', to: 'IN_PROGRESS', authorisedAt: new Date() }),
    ).not.toThrow();
  });

  it('sends additional work back through the SAME gate — there is no bypass', () => {
    // The bill being larger than the quote is the single biggest destroyer of trust in
    // vehicle repair. ADDITIONAL_WORK_FOUND has exactly one exit.
    expect(() => go({ from: 'ADDITIONAL_WORK_FOUND', to: 'IN_PROGRESS' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      go({ from: 'ADDITIONAL_WORK_FOUND', to: 'AWAITING_AUTHORISATION' }),
    ).not.toThrow();
  });

  it('needs a fresh authorisation the moment the scope grows — no tolerance', () => {
    expect(needsReauthorisation(100_000, 100_001)).toBe(true);
    expect(needsReauthorisation(100_000, 100_000)).toBe(false);
    // Cheaper than authorised is fine; nobody complains about a smaller bill.
    expect(needsReauthorisation(100_000, 90_000)).toBe(false);
  });
});

describe('gate 2 — quality control is somebody else’s signature', () => {
  it('refuses a technician signing off their own work', () => {
    // The clearest line between a high-end centre and everyone else.
    expect(() =>
      go({
        from: 'WORK_COMPLETE',
        to: 'QUALITY_CHECK',
        performedByTechnicianId: TECH,
        checkedByTechnicianId: TECH,
      }),
    ).toThrow(/somebody other than the technician/);
  });

  it('accepts a different signature', () => {
    expect(() =>
      go({
        from: 'WORK_COMPLETE',
        to: 'QUALITY_CHECK',
        performedByTechnicianId: TECH,
        checkedByTechnicianId: OTHER,
      }),
    ).not.toThrow();
  });

  it('lets QC send the job back to the bench WITHOUT a new authorisation', () => {
    // A quality check that cannot fail is not a quality check. And rework to correct the
    // workshop's own defect is inside the scope already authorised, done at the workshop's
    // cost — re-authorising it would imply the customer is paying twice.
    expect(() => go({ from: 'QUALITY_CHECK', to: 'IN_PROGRESS' })).not.toThrow();
    expect(() => go({ from: 'ROAD_TEST', to: 'IN_PROGRESS' })).not.toThrow();
  });

  it('still demands authorisation when work RESUMES after waiting for parts', () => {
    // Not rework — this is the original job continuing, and it must still be covered.
    expect(() => go({ from: 'AWAITING_PARTS', to: 'IN_PROGRESS' })).toThrow(/authorised/);
    expect(() =>
      go({ from: 'AWAITING_PARTS', to: 'IN_PROGRESS', authorisedAt: new Date() }),
    ).not.toThrow();
  });
});

describe('gate 3 — high voltage is a named, unexpired certificate', () => {
  const hv = {
    from: 'AUTHORISED' as const,
    to: 'IN_PROGRESS' as const,
    authorisedAt: new Date(),
    categories: ['HIGH_VOLTAGE'] as const,
  };

  it('allows a certified technician', () => {
    expect(() =>
      go({ ...hv, performedByTechnicianId: TECH, competence: hvCertified }),
    ).not.toThrow();
  });

  it('refuses when nobody’s certificate was supplied', () => {
    expect(() => go({ ...hv, performedByTechnicianId: TECH })).toThrow(/certificate/);
  });

  it('refuses somebody else’s certificate', () => {
    // Competence is per person. A certified colleague in the building is not authorisation.
    expect(() =>
      go({ ...hv, performedByTechnicianId: OTHER, competence: hvCertified }),
    ).toThrow(/technician actually performing it/);
  });

  it('refuses a technician certified for something else', () => {
    expect(() =>
      go({
        ...hv,
        performedByTechnicianId: TECH,
        competence: { ...hvCertified, certifiedFor: ['BRAKES'] },
      }),
    ).toThrow(/not certified for high-voltage/);
  });

  it('refuses an EXPIRED certificate', () => {
    // An expired certificate is not a certificate. A traction pack does not care that it
    // lapsed last week.
    expect(() =>
      go({
        ...hv,
        performedByTechnicianId: TECH,
        competence: { ...hvCertified, certifiedUntil: past },
      }),
    ).toThrow(/expired/);
  });

  it('does not gate ordinary work on a high-voltage certificate', () => {
    expect(() =>
      go({
        from: 'AUTHORISED',
        to: 'IN_PROGRESS',
        authorisedAt: new Date(),
        categories: ['GENERAL'],
        performedByTechnicianId: OTHER,
      }),
    ).not.toThrow();
  });
});

describe('gate 4 — nothing leaves unchecked', () => {
  const base = {
    from: 'QUALITY_CHECK' as const,
    to: 'READY_FOR_HANDOVER' as const,
    performedByTechnicianId: TECH,
    checkedByTechnicianId: OTHER,
  };

  it('refuses handover when QC has not passed', () => {
    expect(() => go({ ...base, qualityCheckPassed: false })).toThrow(/quality check/);
  });

  it('demands a road test after brake work', () => {
    expect(() =>
      go({ ...base, qualityCheckPassed: true, categories: ['BRAKES'] }),
    ).toThrow(/road test is required/);
  });

  it.each([['STEERING'], ['SUSPENSION'], ['TYRES']] as const)(
    'demands a road test after %s work too',
    (cat) => {
      expect(() =>
        go({ ...base, qualityCheckPassed: true, categories: [cat] }),
      ).toThrow(/road test/);
    },
  );

  it('releases once the road test is done', () => {
    expect(() =>
      go({
        ...base,
        qualityCheckPassed: true,
        categories: ['BRAKES'],
        roadTestCompleted: true,
      }),
    ).not.toThrow();
  });

  it('does not demand a road test for work that did not touch safety systems', () => {
    // A gate that fires on everything gets routed around.
    expect(() =>
      go({ ...base, qualityCheckPassed: true, categories: ['BODY'] }),
    ).not.toThrow();
  });
});

describe('the machine itself', () => {
  it('has exactly three terminal states', () => {
    const terminal = JOB_STATES.filter(isTerminal);
    expect(terminal.sort()).toEqual(['CANCELLED', 'CLOSED']);
  });

  it('lets nothing continue out of a closed or cancelled job', () => {
    for (const to of JOB_STATES) {
      expect(() => go({ from: 'CLOSED', to })).toThrow(BadRequestException);
      expect(() => go({ from: 'CANCELLED', to })).toThrow(BadRequestException);
    }
  });

  it('rejects a non-integer total rather than comparing floats', () => {
    expect(() => needsReauthorisation(100.5, 200)).toThrow(BadRequestException);
  });
});
