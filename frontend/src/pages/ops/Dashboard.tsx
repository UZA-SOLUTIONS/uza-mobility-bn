import { useAuth } from '@/auth/useAuth';
import { useApi } from '@/hooks/useApi';
import { Card, NotConnected, Notice, Spinner, Stat } from '@/components/ui';
import { rwf } from '@/lib/format';

interface Overview {
  activeListings?: number;
  openOrders?: number;
  financingPipeline?: number;
  monthRevenue?: number;
}

export function OpsDashboard() {
  const { user } = useAuth();
  const { data, loading, error, notConnected } = useApi<Overview>('/admin/dashboard');

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Operations</h1>
      {loading && <Spinner />}
      {notConnected && <NotConnected what="The operations overview" />}
      {error && <Notice>{error}</Notice>}
      {!loading && !error && !notConnected && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Active listings" value={String(data?.activeListings ?? 0)} />
          <Stat label="Open orders" value={String(data?.openOrders ?? 0)} />
          <Stat label="Financing pipeline" value={String(data?.financingPipeline ?? 0)} />
          <Stat label="Revenue this month" value={rwf(data?.monthRevenue)} />
        </div>
      )}
      <Card title="Your roles">
        <div className="flex flex-wrap gap-2 text-sm">
          {(user?.roles ?? []).map((r) => (
            <span key={r} className="rounded bg-brand-soft px-2 py-0.5 text-brand">{r}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
