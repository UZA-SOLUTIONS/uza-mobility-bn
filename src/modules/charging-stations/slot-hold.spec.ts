import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  availableConnectors,
  cancelHold,
  convertToSession,
  DEFAULT_HOLD_MINUTES,
  extendHold,
  holdMinutesFor,
  idleMinutesLostToNoShows,
  isActive,
  MAX_TOTAL_HOLD_MINUTES,
  placeHold,
  REDUCED_HOLD_MINUTES,
  secondsRemaining,
  wasNoShow,
  type DriverRecord,
} from './slot-hold';

const T0 = new Date('2026-08-29T10:00:00Z');
const at = (mins: number) => new Date(T0.getTime() + mins * 60_000);

const clean: DriverRecord = {
  uzaId: 'UZA-P-2026-000141',
  recentHolds: 0,
  recentNoShows: 0,
};

const place = (over: Partial<Parameters<typeof placeHold>[0]> = {}) =>
  placeHold({
    holdId: 'H1',
    connectorId: 'C1',
    uzaId: clean.uzaId,
    existing: [],
    driver: clean,
    connectorAvailable: true,
    now: T0,
    ...over,
  });

describe('a hold expires on its own', () => {
  it('is active before its expiry and not after', () => {
    // Nothing writes a RELEASED status. A driver who changed their mind never releases
    // anything, so the expiry has to be derived from the clock on every read.
    const h = place();
    expect(isActive(h, at(14))).toBe(true);
    expect(isActive(h, at(15))).toBe(false);
    expect(isActive(h, at(60))).toBe(false);
  });

  it('gives a clean driver the full window', () => {
    expect(secondsRemaining(place(), T0)).toBe(DEFAULT_HOLD_MINUTES * 60);
  });

  it('counts down, and floors at zero rather than going negative', () => {
    const h = place();
    expect(secondsRemaining(h, at(5))).toBe(10 * 60);
    expect(secondsRemaining(h, at(99))).toBe(0);
  });
});

describe('who may hold what', () => {
  it('refuses a connector already held by somebody else', () => {
    const theirs = place({ uzaId: 'other', holdId: 'H0' });
    expect(() => place({ existing: [theirs], holdId: 'H2' })).toThrow(
      /already holding that connector/,
    );
  });

  it('lets the next driver hold it once the first hold expires', () => {
    const theirs = place({ uzaId: 'other', holdId: 'H0' });
    expect(() =>
      place({ existing: [theirs], holdId: 'H2', now: at(16) }),
    ).not.toThrow();
  });

  it('refuses a driver holding a second charger across town', () => {
    // Otherwise one driver holds three connectors and two owners earn nothing.
    const mine = place();
    expect(() =>
      place({ existing: [mine], connectorId: 'C2', holdId: 'H2' }),
    ).toThrow(/already have a charger on hold/);
  });

  it('lets them hold again after cancelling', () => {
    const mine = cancelHold(place(), at(2));
    expect(() =>
      place({ existing: [mine], connectorId: 'C2', holdId: 'H2', now: at(3) }),
    ).not.toThrow();
  });

  it('refuses a connector that is in use or out of service', () => {
    expect(() => place({ connectorAvailable: false })).toThrow(
      ConflictException,
    );
  });
});

describe('the no-show consequence', () => {
  it('gives everyone the full window until there is enough history to judge', () => {
    // Judging somebody on their first two holds is noise dressed as policy.
    expect(holdMinutesFor({ ...clean, recentHolds: 3, recentNoShows: 3 })).toBe(
      DEFAULT_HOLD_MINUTES,
    );
  });

  it('shortens the window for a driver who abandons holds', () => {
    expect(
      holdMinutesFor({ ...clean, recentHolds: 10, recentNoShows: 5 }),
    ).toBe(REDUCED_HOLD_MINUTES);
  });

  it('keeps the full window for a driver who mostly turns up', () => {
    expect(
      holdMinutesFor({ ...clean, recentHolds: 10, recentNoShows: 2 }),
    ).toBe(DEFAULT_HOLD_MINUTES);
  });

  it('shortens the hold in practice, not just in the calculation', () => {
    const h = place({
      driver: { ...clean, recentHolds: 10, recentNoShows: 6 },
    });
    expect(secondsRemaining(h, T0)).toBe(REDUCED_HOLD_MINUTES * 60);
  });

  it('does not count a CANCELLED hold as a no-show', () => {
    // Cancelling frees the connector for somebody else. That is the behaviour to
    // encourage, so it must not be punished.
    const cancelled = cancelHold(place(), at(3));
    expect(wasNoShow(cancelled, at(60))).toBe(false);
  });

  it('does not count a hold the driver actually used', () => {
    const used = convertToSession(place(), at(5));
    expect(wasNoShow(used, at(60))).toBe(false);
  });

  it('counts one that simply lapsed', () => {
    expect(wasNoShow(place(), at(60))).toBe(true);
  });
});

describe('extending', () => {
  it('adds time once, for the driver stuck in traffic', () => {
    const e = extendHold(place(), at(10));
    expect(secondsRemaining(e, at(10))).toBe(15 * 60); // 25 min total, 10 elapsed
    expect(e.extensionsUsed).toBe(1);
  });

  it('refuses a second extension', () => {
    const once = extendHold(place(), at(10));
    expect(() => extendHold(once, at(20))).toThrow(/only be extended once/);
  });

  it('never extends past the total ceiling', () => {
    // Unlimited extension is squatting with extra steps.
    const e = extendHold(place(), at(14));
    const totalMinutes =
      (e.expiresAt.getTime() - e.createdAt.getTime()) / 60_000;
    expect(totalMinutes).toBeLessThanOrEqual(MAX_TOTAL_HOLD_MINUTES);
  });

  it('refuses to extend a hold that already ended', () => {
    // That would be a new hold with the queue skipped, and somebody has been waiting.
    expect(() => extendHold(place(), at(20))).toThrow(/already ended/);
  });
});

describe('arriving, and not arriving', () => {
  it('converts a live hold into a session', () => {
    const c = convertToSession(place(), at(9));
    expect(c.convertedAt).toEqual(at(9));
    expect(isActive(c, at(9))).toBe(false); // it is a session now, not a hold
  });

  it('refuses to convert an expired hold, and says the connector may be gone', () => {
    expect(() => convertToSession(place(), at(20))).toThrow(
      /may have been taken/,
    );
  });

  it('treats cancelling an already-ended hold as a no-op rather than an error', () => {
    const h = place();
    expect(cancelHold(h, at(40))).toBe(h);
  });
});

describe('what a driver is offered', () => {
  it('hides connectors that are held right now', () => {
    const held = place({ connectorId: 'C2', holdId: 'H2' });
    expect(availableConnectors(['C1', 'C2', 'C3'], [held], T0)).toEqual([
      'C1',
      'C3',
    ]);
  });

  it('offers them again the moment the hold lapses', () => {
    const held = place({ connectorId: 'C2', holdId: 'H2' });
    expect(availableConnectors(['C1', 'C2'], [held], at(16))).toEqual([
      'C1',
      'C2',
    ]);
  });
});

describe('what abandoned holds cost the station owner', () => {
  it('sums the idle minutes, counting only genuine no-shows', () => {
    // The number that says whether the window is set correctly — and it is the owner, not
    // UZA, who pays for it being wrong.
    const abandoned = place({ holdId: 'A' });
    const used = convertToSession(
      place({ holdId: 'B', connectorId: 'C2' }),
      at(5),
    );
    const cancelled = cancelHold(
      place({ holdId: 'C', connectorId: 'C3' }),
      at(2),
    );
    expect(idleMinutesLostToNoShows([abandoned, used, cancelled], at(60))).toBe(
      15,
    );
  });

  it('is zero when nobody abandoned anything', () => {
    const used = convertToSession(place(), at(5));
    expect(idleMinutesLostToNoShows([used], at(60))).toBe(0);
  });
});
