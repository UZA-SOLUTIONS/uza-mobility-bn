import type { IconType } from 'react-icons';
import {
  FiActivity, FiBattery, FiBriefcase, FiClipboard, FiCreditCard, FiFileText,
  FiGrid, FiHome, FiMapPin, FiPackage, FiTool, FiTrendingUp, FiTruck, FiUsers, FiZap,
} from 'react-icons/fi';

/**
 * Every portal in the application, described as data.
 *
 * This file exists to answer one question: when UZA signs a fifth bank, is that a
 * data change or a code change?
 *
 * It has to be a data change. A portal that needs a developer, a pull request and a
 * deploy every time a lender signs is a portal that gets bypassed by somebody
 * emailing a spreadsheet — which is the disclosure the whole design prevents. So
 * lenders are entries in LENDERS below, and adding one touches no component,
 * no route file and no switch statement.
 *
 * The same holds for the other categories. A second garage, a third charge-point
 * operator, a new insurer: an entry, not a branch.
 */

export interface NavItem {
  label: string;
  to: string;
  icon: IconType;
  /** Permission the API enforces. Absent means every member of the portal sees it. */
  permission?: string;
}

export interface PortalDefinition {
  /** Stable key. Appears in URLs, so it must not change once live. */
  key: string;
  name: string;
  /** Everything under this path belongs to the portal. */
  basePath: string;
  /** Any one of these role names grants entry. Resolved against the API's roles. */
  roles: string[];
  icon: IconType;
  /** Tailwind accent token. Each portal reads as a distinct place. */
  accent: string;
  nav: NavItem[];
  /**
   * Category, for portals that come in kinds. A new stakeholder of an existing
   * category is generated from a template below rather than hand-written.
   */
  category?: 'lender' | 'garage' | 'charge-operator';
}

/* ------------------------------------------------------------------ */
/* Lenders — the category that grows                                   */
/* ------------------------------------------------------------------ */

export interface LenderConfig {
  key: string;
  name: string;
  /**
   * Whether this lender may see the cash-collateral facility.
   *
   * The default is false and it must stay that way. Onboarding a lender is routine
   * and should be data; granting one sight of the collateral facility is a founder's
   * decision. Widening it is a deliberate edit to this file that somebody reviews.
   */
  seesCollateral?: boolean;
}

export const LENDERS: LenderConfig[] = [
  { key: 'unguka', name: 'Unguka Bank (LOLC)', seesCollateral: true },
  { key: 'equity', name: 'Equity Bank Rwanda' },
  { key: 'ncba', name: 'NCBA Rwanda' },
];

function lenderPortal(lender: LenderConfig): PortalDefinition {
  const base = `/lender/${lender.key}`;
  return {
    key: `lender-${lender.key}`,
    name: lender.name,
    basePath: base,
    // Convention, not configuration: the role name follows from the key, so
    // onboarding a lender is one row here and one role row in the database.
    roles: [`LENDER_${lender.key.toUpperCase()}`, 'SUPER_ADMIN'],
    icon: FiBriefcase,
    accent: 'accent-lender',
    category: 'lender',
    nav: [
      { label: 'Overview', to: `${base}`, icon: FiHome },
      { label: 'Applications', to: `${base}/applications`, icon: FiFileText },
      { label: 'Borrowers', to: `${base}/borrowers`, icon: FiUsers },
      { label: 'Disbursements', to: `${base}/disbursements`, icon: FiCreditCard },
      { label: 'Portfolio', to: `${base}/portfolio`, icon: FiTrendingUp },
      // Rendered only for a lender the list above entitles. Every other lender's
      // navigation does not mention that the facility exists.
      ...(lender.seesCollateral
        ? [{ label: 'Credit enhancement', to: `${base}/collateral`, icon: FiActivity }]
        : []),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* The registry                                                        */
/* ------------------------------------------------------------------ */

export const PORTALS: PortalDefinition[] = [
  {
    key: 'client',
    name: 'My vehicle',
    basePath: '/client',
    roles: ['CLIENT', 'DRIVER', 'BUYER', 'SUPER_ADMIN'],
    icon: FiTruck,
    accent: 'accent-client',
    nav: [
      { label: 'Home', to: '/client', icon: FiHome },
      { label: 'My vehicle', to: '/client/vehicle', icon: FiTruck },
      { label: 'Payments', to: '/client/payments', icon: FiCreditCard },
      { label: 'Charging', to: '/client/charging', icon: FiZap },
      { label: 'Service & repairs', to: '/client/service', icon: FiTool },
      { label: 'Documents', to: '/client/documents', icon: FiFileText },
    ],
  },
  ...LENDERS.map(lenderPortal),
  {
    key: 'workshop',
    name: 'Workshop',
    basePath: '/workshop',
    roles: ['MECHANIC', 'WORKSHOP_ADMIN', 'SUPER_ADMIN'],
    icon: FiTool,
    accent: 'accent-workshop',
    category: 'garage',
    nav: [
      { label: 'Board', to: '/workshop', icon: FiGrid },
      { label: 'Job cards', to: '/workshop/job-cards', icon: FiClipboard },
      { label: 'Rescue', to: '/workshop/rescue', icon: FiActivity },
      { label: 'Parts', to: '/workshop/parts', icon: FiPackage },
      { label: 'Mechanics', to: '/workshop/mechanics', icon: FiUsers },
    ],
  },
  {
    key: 'charging',
    name: 'Charging network',
    basePath: '/charging',
    roles: ['CHARGE_OPERATOR', 'FLEET_ADMIN', 'SUPER_ADMIN'],
    icon: FiZap,
    accent: 'accent-charging',
    category: 'charge-operator',
    nav: [
      { label: 'Find a charger', to: '/charging', icon: FiMapPin },
      { label: 'My bookings', to: '/charging/bookings', icon: FiClipboard },
      { label: 'Stations', to: '/charging/stations', icon: FiBattery },
    ],
  },
  {
    key: 'ops',
    name: 'Operations',
    basePath: '/ops',
    roles: ['SUPER_ADMIN', 'MARKETPLACE_ADMIN', 'FLEET_ADMIN', 'FINANCE_ADMIN', 'LOGISTICS_ADMIN'],
    icon: FiGrid,
    accent: 'accent-ops',
    nav: [
      { label: 'Dashboard', to: '/ops', icon: FiHome },
      { label: 'Listings', to: '/ops/listings', icon: FiPackage },
      { label: 'Orders', to: '/ops/orders', icon: FiTruck },
      { label: 'Financing', to: '/ops/financing', icon: FiCreditCard },
      { label: 'People', to: '/ops/people', icon: FiUsers },
    ],
  },
];

export const portalByKey = (key: string) => PORTALS.find((p) => p.key === key);

/** The portals this set of roles may enter, in registry order. */
export function portalsFor(roles: string[]): PortalDefinition[] {
  return PORTALS.filter((p) => p.roles.some((r) => roles.includes(r)));
}

/** Where to send someone after login: their first portal, or nowhere. */
export function landingPathFor(roles: string[]): string | null {
  return portalsFor(roles)[0]?.basePath ?? null;
}
