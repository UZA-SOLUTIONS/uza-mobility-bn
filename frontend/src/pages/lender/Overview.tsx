import { useApi } from '@/hooks/useApi';
import { Card, Empty, NotConnected, Notice, Spinner, Stat } from '@/components/ui';
import { rwf } from '@/lib/format';
import type { LenderConfig } from '@/portals/registry';

interface Portfolio {
  applicationsPending?: number;
  activeLoans?: number;
  disbursedTotal?: number;
  arrearsTotal?: number;
}

export function LenderOverview({ lender }: { lender: LenderConfig }) {
  const { data, loading, error, notConnected } = useApi<Portfolio>(`/financing/lenders/${lender.key}/summary`);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{lender.name}</h1>
        <p className="text-sm text-ink-soft">
          Applications and portfolio for your institution only.
        </p>
      </div>

      {loading && <Spinner />}
      {notConnected && <NotConnected what={`The ${lender.name} portfolio`} />}
      {error && <Notice>{error}</Notice>}

      {!loading && !error && !notConnected && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Applications pending" value={String(data?.applicationsPending ?? 0)} />
          <Stat label="Active loans" value={String(data?.activeLoans ?? 0)} />
          <Stat label="Disbursed" value={rwf(data?.disbursedTotal)} />
          <Stat label="In arrears" value={rwf(data?.arrearsTotal)} />
        </div>
      )}

      <Card title="What you can see here">
        <p className="text-sm text-ink-soft">
          Borrower files are shown only where the borrower has consented to share them
          with {lender.name}. Files belonging to other institutions are not visible, and
          a reference that is not yours returns the same answer as one that does not
          exist.
        </p>
      </Card>
    </div>
  );
}

/**
 * The cash-collateral facility.
 *
 * This route is only mounted for a lender whose registry entry sets `seesCollateral`.
 * The guard is at the route, not inside the component, so a lender without the
 * entitlement has no path to render it at all — and their navigation never mentions
 * that the facility exists.
 */
export function LenderCollateral({ lender }: { lender: LenderConfig }) {
  const { data, loading, error, notConnected } = useApi<{ pledged?: number; released?: number; calledBack?: number }>(
    `/financing/lenders/${lender.key}/credit-enhancement`,
  );

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Credit enhancement</h1>
      {loading && <Spinner />}
      {notConnected && <NotConnected what="The credit-enhancement ledger" />}
      {error && <Notice>{error}</Notice>}
      {!loading && !error && !notConnected && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Pledged" value={rwf(data?.pledged)} />
          <Stat label="Released" value={rwf(data?.released)} />
          <Stat label="Called back" value={rwf(data?.calledBack)} />
        </div>
      )}
      <Card>
        <Empty>
          Figures are drawn from the facility ledger. UZA does not hold client money;
          amounts shown here sit in the facility account under its own terms.
        </Empty>
      </Card>
    </div>
  );
}
