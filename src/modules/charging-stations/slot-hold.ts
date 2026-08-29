import { BadRequestException, ConflictException } from '@nestjs/common';

/**
 * Holding a charging connector.
 *
 * A driver twenty minutes away wants to know the charger will still be free when they
 * arrive. The station owner wants it earning, not standing idle because somebody tapped
 * "reserve" and went to lunch. Everything here is that tension.
 *
 * ── THE RULE THAT MAKES IT WORK ───────────────────────────────────────────────────────
 *
 * **A hold is free to place and expensive to abuse, so it must expire on its own.**
 *
 * Not "the driver releases it" — a driver who changed their mind never releases anything.
 * The hold carries its own expiry from the moment it is created, and an expired hold is
 * not a hold. Every read re-derives that from the clock rather than trusting a status
 * column somebody forgot to update, which is why `isActive` takes `now` and why nothing
 * here has a `RELEASED` state that a background job has to remember to write.
 *
 * ── WHY THE LIMITS ARE WHAT THEY ARE ──────────────────────────────────────────────────
 *
 * One live hold per driver, or a driver holds three chargers across the city and two
 * station owners earn nothing.
 *
 * One live hold per connector, obviously — but the check has to be a database uniqueness
 * constraint as well as this function, because two requests arriving in the same
 * millisecond both pass a read-then-write check.
 *
 * Extensions are capped rather than forbidden. Traffic is real, and a driver stuck on the
 * Nyabugogo road should be able to say so once. Unlimited extension is just squatting with
 * extra steps.
 *
 * No-shows carry a consequence, because a hold that costs nothing to abandon will be
 * abandoned. The consequence here is a shorter hold window, not a ban: the aim is to make
 * the honest driver's promise credible, not to punish somebody whose meeting overran.
 */

export const DEFAULT_HOLD_MINUTES = 15;
/** A driver with a poor recent record gets less rope, not none. */
export const REDUCED_HOLD_MINUTES = 7;
/** Total life of a hold including every extension. */
export const MAX_TOTAL_HOLD_MINUTES = 30;
export const EXTENSION_MINUTES = 10;
export const MAX_EXTENSIONS = 1;
/** Above this share of recent holds abandoned, the window shortens. */
export const NO_SHOW_THRESHOLD = 0.3;
/** Below this many recent holds, there is not enough history to judge anybody. */
export const MIN_HOLDS_TO_JUDGE = 4;

export interface Hold {
  holdId: string;
  connectorId: string;
  /** The UZA ID. One person, one identifier, across the estate. */
  uzaId: string;
  createdAt: Date;
  expiresAt: Date;
  extensionsUsed: number;
  /** Set when the driver arrived and plugged in. A converted hold is no longer a hold. */
  convertedAt?: Date | null;
  /** Set when the driver gave it up deliberately. */
  cancelledAt?: Date | null;
}

export interface DriverRecord {
  uzaId: string;
  /** Holds placed in the recent window. */
  recentHolds: number;
  /** Of those, how many expired without the driver arriving. */
  recentNoShows: number;
}

export const isActive = (h: Hold, now: Date): boolean =>
  !h.convertedAt && !h.cancelledAt && h.expiresAt.getTime() > now.getTime();

/**
 * How long this driver may hold for.
 *
 * Shortened for a driver who abandons holds, but only once there is enough history to say
 * so. Judging somebody on their first two holds is noise dressed as policy.
 */
export function holdMinutesFor(rec: DriverRecord): number {
  if (rec.recentHolds < MIN_HOLDS_TO_JUDGE) return DEFAULT_HOLD_MINUTES;
  const rate = rec.recentNoShows / rec.recentHolds;
  return rate > NO_SHOW_THRESHOLD ? REDUCED_HOLD_MINUTES : DEFAULT_HOLD_MINUTES;
}

export interface PlaceHoldInput {
  holdId: string;
  connectorId: string;
  uzaId: string;
  /** Every hold currently in the system. Expired ones are ignored, not filtered by the caller. */
  existing: readonly Hold[];
  driver: DriverRecord;
  connectorAvailable: boolean;
  now: Date;
}

/**
 * Place a hold, or refuse with a reason the driver can act on.
 *
 * Refusals are `ConflictException` rather than a boolean because every one of them is a
 * state the caller must surface to a person, not a branch to fall through.
 */
export function placeHold(input: PlaceHoldInput): Hold {
  const { now, existing, uzaId, connectorId } = input;

  if (!input.connectorAvailable) {
    throw new ConflictException('That connector is in use or out of service.');
  }

  const live = existing.filter((h) => isActive(h, now));

  if (live.some((h) => h.connectorId === connectorId)) {
    // Also enforced by a unique index on (connectorId) where the hold is live — two
    // requests in the same millisecond both pass a read-then-write check.
    throw new ConflictException('Somebody is already holding that connector.');
  }

  const mine = live.find((h) => h.uzaId === uzaId);
  if (mine) {
    throw new ConflictException(
      'You already have a charger on hold. Release it before holding another.',
    );
  }

  const minutes = holdMinutesFor(input.driver);
  return {
    holdId: input.holdId,
    connectorId,
    uzaId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + minutes * 60_000),
    extensionsUsed: 0,
    convertedAt: null,
    cancelledAt: null,
  };
}

/**
 * Extend a hold once, within the total cap.
 *
 * An expired hold cannot be extended — that would be a new hold with the queue skipped,
 * and the driver behind them has been waiting.
 */
export function extendHold(hold: Hold, now: Date): Hold {
  if (!isActive(hold, now)) {
    throw new ConflictException('That hold has already ended. Place a new one.');
  }
  if (hold.extensionsUsed >= MAX_EXTENSIONS) {
    throw new ConflictException('A hold can only be extended once.');
  }

  const proposed = new Date(hold.expiresAt.getTime() + EXTENSION_MINUTES * 60_000);
  const ceiling = new Date(hold.createdAt.getTime() + MAX_TOTAL_HOLD_MINUTES * 60_000);
  // Extend up to the ceiling, never past it. Silently clamping is right here: the driver
  // gets what is available rather than an error that helps nobody.
  const expiresAt = proposed.getTime() > ceiling.getTime() ? ceiling : proposed;

  if (expiresAt.getTime() <= hold.expiresAt.getTime()) {
    throw new ConflictException('This hold is already at its maximum length.');
  }
  return { ...hold, expiresAt, extensionsUsed: hold.extensionsUsed + 1 };
}

/** The driver arrived and plugged in. From here it is a session, not a hold. */
export function convertToSession(hold: Hold, now: Date): Hold {
  if (!isActive(hold, now)) {
    throw new ConflictException('That hold has expired. The connector may have been taken.');
  }
  return { ...hold, convertedAt: now };
}

export function cancelHold(hold: Hold, now: Date): Hold {
  if (!isActive(hold, now)) return hold; // Cancelling an ended hold is a no-op, not an error.
  return { ...hold, cancelledAt: now };
}

/** Seconds left, floored at zero. For a countdown the driver can see. */
export function secondsRemaining(hold: Hold, now: Date): number {
  if (!isActive(hold, now)) return 0;
  return Math.max(0, Math.floor((hold.expiresAt.getTime() - now.getTime()) / 1000));
}

/**
 * Was this hold abandoned?
 *
 * Expired, never converted, never cancelled. A driver who cancels is **not** a no-show —
 * they freed the connector for somebody else, which is the behaviour to encourage.
 */
export function wasNoShow(hold: Hold, now: Date): boolean {
  return (
    !hold.convertedAt && !hold.cancelledAt && hold.expiresAt.getTime() <= now.getTime()
  );
}

/** Connectors a driver may still be offered, given what is held right now. */
export function availableConnectors(
  connectorIds: readonly string[],
  holds: readonly Hold[],
  now: Date,
): string[] {
  const held = new Set(holds.filter((h) => isActive(h, now)).map((h) => h.connectorId));
  return connectorIds.filter((id) => !held.has(id));
}

/**
 * Minutes of connector time lost to abandoned holds over a period.
 *
 * The number that decides whether the hold window is set correctly. If it is large, the
 * window is too long or the no-show consequence too soft — and it is the station owner,
 * not UZA, who is paying for it.
 */
export function idleMinutesLostToNoShows(holds: readonly Hold[], now: Date): number {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new BadRequestException('now must be a valid date');
  }
  return holds
    .filter((h) => wasNoShow(h, now))
    .reduce(
      (sum, h) => sum + (h.expiresAt.getTime() - h.createdAt.getTime()) / 60_000,
      0,
    );
}
