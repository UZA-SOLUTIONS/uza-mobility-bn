import { describe, expect, it } from 'vitest';
import { LENDERS, PORTALS, landingPathFor, portalsFor } from './registry';

/**
 * Onboarding a new stakeholder in an existing category.
 *
 * The question this file answers: when UZA signs a fifth bank, is that a data change
 * or a code change?
 *
 * It must be a data change. A portal that needs a developer, a pull request and a
 * deploy every time a lender signs is a portal that gets bypassed by somebody
 * emailing a spreadsheet — which is the disclosure this design exists to prevent.
 *
 * The mirror of this test lives in the Nexus API. Both must keep agreeing.
 */

describe('a lender is a row, not a branch', () => {
  it('gives every configured lender its own portal, navigation and path', () => {
    for (const lender of LENDERS) {
      const portal = PORTALS.find((p) => p.key === `lender-${lender.key}`);
      expect(portal, `no portal generated for ${lender.key}`).toBeDefined();
      expect(portal!.basePath).toBe(`/lender/${lender.key}`);
      expect(portal!.nav.length).toBeGreaterThan(0);
      expect(portal!.category).toBe('lender');
    }
  });

  it('derives the role name from the key, so onboarding is one row plus one role', () => {
    for (const lender of LENDERS) {
      const portal = PORTALS.find((p) => p.key === `lender-${lender.key}`)!;
      expect(portal.roles).toContain(`LENDER_${lender.key.toUpperCase()}`);
    }
  });

  it('never lets one lender into another lender’s portal', () => {
    for (const a of LENDERS) {
      for (const b of LENDERS) {
        if (a.key === b.key) continue;
        const theirs = PORTALS.find((p) => p.key === `lender-${b.key}`)!;
        expect(theirs.roles).not.toContain(`LENDER_${a.key.toUpperCase()}`);
      }
    }
  });
});

describe('the collateral facility is deliberately not routine', () => {
  it('is visible to Unguka and to nobody else', () => {
    // The one entitlement onboarding must never grant by default. Widening it is a
    // founder's decision, so it should require this file to change, this test to
    // change, and somebody to review both.
    const entitled = LENDERS.filter((l) => l.seesCollateral).map((l) => l.key);
    expect(entitled).toEqual(['unguka']);
  });

  it('keeps it out of the navigation of every other lender', () => {
    // Not merely blocked — absent. A greyed-out link still tells Equity the facility
    // exists, and that is itself the disclosure.
    for (const lender of LENDERS.filter((l) => !l.seesCollateral)) {
      const portal = PORTALS.find((p) => p.key === `lender-${lender.key}`)!;
      const labels = portal.nav.map((n) => n.label.toLowerCase()).join(' ');
      expect(labels).not.toMatch(/collateral|credit enhancement/);
      expect(portal.nav.some((n) => n.to.endsWith('/collateral'))).toBe(false);
    }
  });

  it('does show it to the entitled lender', () => {
    const unguka = PORTALS.find((p) => p.key === 'lender-unguka')!;
    expect(unguka.nav.some((n) => n.to.endsWith('/collateral'))).toBe(true);
  });
});

describe('who lands where', () => {
  it('sends somebody to a portal their roles actually open', () => {
    const path = landingPathFor(['LENDER_EQUITY']);
    expect(path).toBe('/lender/equity');
  });

  it('sends a self-registered buyer somewhere real rather than nowhere', () => {
    // Registration assigns BUYER. If the registry does not know that role, every new
    // account lands on "no portal assigned" — which is how this was found.
    expect(landingPathFor(['BUYER'])).toBe('/client');
  });

  it('returns null rather than guessing when no role opens anything', () => {
    expect(landingPathFor(['SOME_UNKNOWN_ROLE'])).toBeNull();
    expect(portalsFor([])).toEqual([]);
  });

  it('opens everything for SUPER_ADMIN', () => {
    expect(portalsFor(['SUPER_ADMIN']).length).toBe(PORTALS.length);
  });
});

describe('the registry itself stays coherent', () => {
  it('has no duplicate keys or base paths', () => {
    expect(new Set(PORTALS.map((p) => p.key)).size).toBe(PORTALS.length);
    expect(new Set(PORTALS.map((p) => p.basePath)).size).toBe(PORTALS.length);
  });

  it('keeps every navigation entry inside its own portal', () => {
    // A link that escapes its base path is a link into somebody else's portal.
    for (const portal of PORTALS) {
      for (const item of portal.nav) {
        expect(item.to.startsWith(portal.basePath)).toBe(true);
      }
    }
  });
});
