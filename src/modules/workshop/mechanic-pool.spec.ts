import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertPricingAllowed,
  eligibleForJob,
  expiringSoon,
  isCertificationCurrent,
  maySupervise,
  mayWorkUnsupervised,
  type Mechanic,
} from './mechanic-pool';

const now = new Date('2026-08-29');
const valid = new Date('2027-01-01');
const expired = new Date('2026-01-01');

const mech = (over: Partial<Mechanic> & Pick<Mechanic, 'mechanicId'>): Mechanic => ({
  uzaId: `UZA-P-2026-${over.mechanicId}`,
  engagement: 'EMPLOYED',
  level: 'TECHNICIAN',
  certifiedFor: ['GENERAL'],
  certifiedUntil: valid,
  suspendedAt: null,
  ...over,
});

describe('who may work unsupervised', () => {
  it('allows a certified technician on a category they hold', () => {
    expect(mayWorkUnsupervised(mech({ mechanicId: 'a' }), 'GENERAL', now)).toBe(true);
  });

  it('never allows an apprentice, however well certified', () => {
    // That is what apprentice means.
    const a = mech({
      mechanicId: 'app',
      level: 'APPRENTICE',
      certifiedFor: ['GENERAL', 'HIGH_VOLTAGE'],
    });
    expect(mayWorkUnsupervised(a, 'GENERAL', now)).toBe(false);
    expect(mayWorkUnsupervised(a, 'HIGH_VOLTAGE', now)).toBe(false);
  });

  it('refuses a category the person is not certified for', () => {
    expect(mayWorkUnsupervised(mech({ mechanicId: 'b' }), 'HIGH_VOLTAGE', now)).toBe(false);
  });

  it('refuses an expired certificate, and a suspended partner', () => {
    expect(
      mayWorkUnsupervised(mech({ mechanicId: 'c', certifiedUntil: expired }), 'GENERAL', now),
    ).toBe(false);
    expect(
      mayWorkUnsupervised(mech({ mechanicId: 'd', suspendedAt: now }), 'GENERAL', now),
    ).toBe(false);
  });

  it('treats level and certification as independent', () => {
    // A MASTER whose HV certificate lapsed may not touch a pack. Seniority is not competence
    // in a specific category, and conflating them is how somebody senior gets electrocuted.
    const master = mech({
      mechanicId: 'm',
      level: 'MASTER',
      certifiedFor: ['HIGH_VOLTAGE'],
      certifiedUntil: expired,
    });
    expect(mayWorkUnsupervised(master, 'HIGH_VOLTAGE', now)).toBe(false);
  });
});

describe('supervision', () => {
  it('requires seniority AND certification in the thing being supervised', () => {
    // Supervising work you are not certified for is not supervision, it is company.
    const seniorNoHv = mech({ mechanicId: 's', level: 'SENIOR', certifiedFor: ['GENERAL'] });
    expect(maySupervise(seniorNoHv, 'GENERAL', now)).toBe(true);
    expect(maySupervise(seniorNoHv, 'HIGH_VOLTAGE', now)).toBe(false);
  });

  it('refuses a technician who is not senior enough', () => {
    const tech = mech({ mechanicId: 't', level: 'TECHNICIAN' });
    expect(maySupervise(tech, 'GENERAL', now)).toBe(false);
  });

  it('allows a master with a current certificate', () => {
    const master = mech({
      mechanicId: 'm2',
      level: 'MASTER',
      certifiedFor: ['HIGH_VOLTAGE'],
    });
    expect(maySupervise(master, 'HIGH_VOLTAGE', now)).toBe(true);
  });
});

describe('who prices the labour — the misclassification guard', () => {
  it('refuses UZA pricing an independent partner’s labour', () => {
    // Set their price, schedule their day and pay them per job, and it is employment in
    // substance whatever the contract says.
    const partner = mech({ mechanicId: 'p', engagement: 'CERTIFIED' });
    expect(() => assertPricingAllowed(partner, 'UZA')).toThrow(BadRequestException);
    expect(() => assertPricingAllowed(partner, 'UZA')).toThrow(/employment relationship/);
  });

  it('lets an independent set their own price', () => {
    expect(() =>
      assertPricingAllowed(mech({ mechanicId: 'p2', engagement: 'CERTIFIED' }), 'MECHANIC'),
    ).not.toThrow();
  });

  it('refuses an employed technician setting their own price', () => {
    expect(() =>
      assertPricingAllowed(mech({ mechanicId: 'e', engagement: 'EMPLOYED' }), 'MECHANIC'),
    ).toThrow(BadRequestException);
  });

  it('lets UZA price its own employee’s work', () => {
    expect(() =>
      assertPricingAllowed(mech({ mechanicId: 'e2', engagement: 'EMPLOYED' }), 'UZA'),
    ).not.toThrow();
  });
});

describe('offering a job to the pool', () => {
  const pool = [
    mech({ mechanicId: 'emp-hv', certifiedFor: ['HIGH_VOLTAGE'] }),
    mech({ mechanicId: 'partner-hv', engagement: 'CERTIFIED', certifiedFor: ['HIGH_VOLTAGE'] }),
    mech({ mechanicId: 'emp-gen' }),
    mech({ mechanicId: 'apprentice', level: 'APPRENTICE', certifiedFor: ['HIGH_VOLTAGE'] }),
  ];

  it('offers HV work to everyone certified, employed or partner', () => {
    const out = eligibleForJob(pool, { category: 'HIGH_VOLTAGE', now });
    expect(out.map((m) => m.mechanicId).sort()).toEqual(['emp-hv', 'partner-hv']);
  });

  it('restricts to employees when UZA has warranted the work to a lender', () => {
    // Battery health, HV work and the inspection product are promises UZA made to a bank.
    // They are done by UZA's own people, not by a partner UZA merely certifies.
    const out = eligibleForJob(pool, {
      category: 'HIGH_VOLTAGE',
      restrictToEmployed: true,
      now,
    });
    expect(out.map((m) => m.mechanicId)).toEqual(['emp-hv']);
  });

  it('never offers a job to an apprentice', () => {
    const out = eligibleForJob(pool, { category: 'HIGH_VOLTAGE', now });
    expect(out.some((m) => m.mechanicId === 'apprentice')).toBe(false);
  });

  it('returns an empty list rather than throwing when nobody qualifies', () => {
    expect(eligibleForJob(pool, { category: 'BODY', now })).toEqual([]);
  });
});

describe('certifications expiring', () => {
  const soon = new Date('2026-09-10'); // 12 days out
  const later = new Date('2026-11-01');

  const pool = [
    mech({ mechanicId: 'later', certifiedUntil: later }),
    mech({ mechanicId: 'soon', certifiedUntil: soon }),
    mech({ mechanicId: 'already-expired', certifiedUntil: expired }),
    mech({ mechanicId: 'suspended', certifiedUntil: soon, suspendedAt: now }),
  ];

  it('lists those about to lapse, soonest first', () => {
    // An expired certificate silently removes somebody from every eligibility check above.
    // A technician who cannot be dispatched and does not know why is a rota problem that
    // looks like a software bug.
    // `later` is 64 days out, so a 30-day window correctly excludes it. A 90-day one
    // includes both, soonest first — which is the ordering renewal scheduling depends on.
    expect(expiringSoon(pool, 30, now).map((m) => m.mechanicId)).toEqual(['soon']);
    expect(expiringSoon(pool, 90, now).map((m) => m.mechanicId)).toEqual(['soon', 'later']);
  });

  it('excludes those already expired — that is a different list and a different action', () => {
    expect(expiringSoon(pool, 30, now).some((m) => m.mechanicId === 'already-expired')).toBe(
      false,
    );
  });

  it('excludes suspended partners', () => {
    expect(expiringSoon(pool, 30, now).some((m) => m.mechanicId === 'suspended')).toBe(false);
  });

  it('narrows as the window narrows', () => {
    expect(expiringSoon(pool, 14, now).map((m) => m.mechanicId)).toEqual(['soon']);
    expect(expiringSoon(pool, 1, now)).toEqual([]);
  });

  it('rejects a nonsensical window', () => {
    expect(() => expiringSoon(pool, -1, now)).toThrow(BadRequestException);
  });
});

describe('isCertificationCurrent', () => {
  it('is false for suspended and for expired, true otherwise', () => {
    expect(isCertificationCurrent(mech({ mechanicId: 'ok' }), now)).toBe(true);
    expect(isCertificationCurrent(mech({ mechanicId: 'x', certifiedUntil: expired }), now)).toBe(
      false,
    );
    expect(isCertificationCurrent(mech({ mechanicId: 'y', suspendedAt: now }), now)).toBe(false);
  });
});
