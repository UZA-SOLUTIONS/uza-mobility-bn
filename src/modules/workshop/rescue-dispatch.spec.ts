import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  dispatch,
  referralCommission,
  requiresRecovery,
  type Responder,
} from './rescue-dispatch';

const now = new Date('2026-08-29');
const valid = new Date('2027-01-01');
const expired = new Date('2026-01-01');

const responder = (over: Partial<Responder> & Pick<Responder, 'responderId'>): Responder => ({
  name: over.responderId,
  distanceKm: 5,
  certifiedFor: ['GENERAL'],
  certifiedUntil: valid,
  available: true,
  rating: 4,
  openJobs: 0,
  ...over,
});

describe('who gets sent', () => {
  it('sends the nearest available certified responder', () => {
    const r = dispatch({
      category: 'GENERAL',
      now,
      responders: [
        responder({ responderId: 'far', distanceKm: 18 }),
        responder({ responderId: 'near', distanceKm: 3 }),
        responder({ responderId: 'mid', distanceKm: 9 }),
      ],
    });
    expect(r?.chosen.responderId).toBe('near');
    expect(r?.alternatives.map((a) => a.responderId)).toEqual(['mid', 'far']);
  });

  it('skips whoever is unavailable, expired, or not certified for this fault', () => {
    const r = dispatch({
      category: 'GENERAL',
      now,
      responders: [
        responder({ responderId: 'busy', distanceKm: 1, available: false }),
        responder({ responderId: 'lapsed', distanceKm: 2, certifiedUntil: expired }),
        responder({ responderId: 'wrong-skill', distanceKm: 3, certifiedFor: ['BODY'] }),
        responder({ responderId: 'ok', distanceKm: 12 }),
      ],
    });
    expect(r?.chosen.responderId).toBe('ok');
  });

  it('will not send somebody beyond the roadside radius', () => {
    expect(
      dispatch({
        category: 'GENERAL',
        now,
        responders: [responder({ responderId: 'too-far', distanceKm: 40 })],
      }),
    ).toBeNull();
  });

  it('returns null rather than throwing when nobody can go', () => {
    // "Nobody is available" is a real operational answer the caller must tell the customer,
    // not an exception to be logged and swallowed.
    expect(dispatch({ category: 'GENERAL', now, responders: [] })).toBeNull();
  });
});

describe('the rule that overrides distance', () => {
  it('sends an HV-certified responder even when somebody closer is not', () => {
    // A stranded EV is not a car with a flat battery. Nearest-wins is the right default and
    // the wrong rule for a traction pack.
    const r = dispatch({
      category: 'HIGH_VOLTAGE',
      now,
      responders: [
        responder({ responderId: 'close-no-hv', distanceKm: 1, certifiedFor: ['GENERAL'] }),
        responder({ responderId: 'far-hv', distanceKm: 22, certifiedFor: ['HIGH_VOLTAGE'] }),
      ],
    });
    expect(r?.chosen.responderId).toBe('far-hv');
    expect(r?.reason).toMatch(/HV-certified/);
  });

  it('sends nobody rather than sending an uncertified responder to an HV fault', () => {
    // The dispatcher at 9pm under pressure must not be the last line of defence.
    expect(
      dispatch({
        category: 'HIGH_VOLTAGE',
        now,
        responders: [responder({ responderId: 'close', distanceKm: 1, certifiedFor: ['GENERAL'] })],
      }),
    ).toBeNull();
  });

  it('refuses an HV responder whose certificate lapsed', () => {
    expect(
      dispatch({
        category: 'HIGH_VOLTAGE',
        now,
        responders: [
          responder({
            responderId: 'lapsed-hv',
            distanceKm: 2,
            certifiedFor: ['HIGH_VOLTAGE'],
            certifiedUntil: expired,
          }),
        ],
      }),
    ).toBeNull();
  });
});

describe('breaking a tie', () => {
  it('prefers the better rated when two are effectively equidistant', () => {
    const r = dispatch({
      category: 'GENERAL',
      now,
      responders: [
        responder({ responderId: 'a', distanceKm: 5, rating: 3 }),
        responder({ responderId: 'b', distanceKm: 6, rating: 5 }),
      ],
    });
    expect(r?.chosen.responderId).toBe('b');
  });

  it('does NOT let rating beat a materially closer responder', () => {
    // Rating breaks a tie. It does not send a customer an extra fifteen kilometres away.
    const r = dispatch({
      category: 'GENERAL',
      now,
      responders: [
        responder({ responderId: 'near-ok', distanceKm: 2, rating: 3 }),
        responder({ responderId: 'far-great', distanceKm: 17, rating: 5 }),
      ],
    });
    expect(r?.chosen.responderId).toBe('near-ok');
  });

  it('prefers the least loaded when distance and rating both tie', () => {
    const r = dispatch({
      category: 'GENERAL',
      now,
      responders: [
        responder({ responderId: 'loaded', distanceKm: 5, rating: 4, openJobs: 3 }),
        responder({ responderId: 'free', distanceKm: 5, rating: 4, openJobs: 0 }),
      ],
    });
    expect(r?.chosen.responderId).toBe('free');
  });

  it('is stable — the same input always gives the same answer', () => {
    // Two dispatchers running the same query must not see different "best" responders, or
    // neither can explain their screen.
    const rs = [
      responder({ responderId: 'z', distanceKm: 5 }),
      responder({ responderId: 'a', distanceKm: 5 }),
    ];
    const first = dispatch({ category: 'GENERAL', now, responders: rs })?.chosen.responderId;
    const second = dispatch({ category: 'GENERAL', now, responders: [...rs].reverse() })
      ?.chosen.responderId;
    expect(first).toBe(second);
    expect(first).toBe('a');
  });
});

describe('what happens at the roadside, and what does not', () => {
  it('recovers rather than repairs anything safety-critical or high-voltage', () => {
    for (const c of ['HIGH_VOLTAGE', 'BRAKES', 'STEERING', 'SUSPENSION', 'TYRES'] as const) {
      expect(requiresRecovery(c)).toBe(true);
    }
  });

  it('allows ordinary faults to be fixed where the vehicle stands', () => {
    expect(requiresRecovery('GENERAL')).toBe(false);
    expect(requiresRecovery('BODY')).toBe(false);
  });
});

describe('the referral commission', () => {
  it('is a whole number of minor units', () => {
    expect(referralCommission(100_000, 10)).toBe(10_000);
    expect(referralCommission(99_999, 7.5)).toBe(7_500);
    expect(Number.isInteger(referralCommission(12_345, 3.3))).toBe(true);
  });

  it('is zero on a zero-value job rather than an error', () => {
    expect(referralCommission(0, 10)).toBe(0);
  });

  it('rejects a float job value and an impossible rate', () => {
    expect(() => referralCommission(100.5, 10)).toThrow(BadRequestException);
    expect(() => referralCommission(100, 101)).toThrow(BadRequestException);
    expect(() => referralCommission(100, -1)).toThrow(BadRequestException);
  });
});
