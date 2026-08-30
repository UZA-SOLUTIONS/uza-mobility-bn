import { useAuth } from '@/auth/useAuth';
import { useApi } from '@/hooks/useApi';
import { Card, Empty, NotConnected, Notice, Spinner, Stat } from '@/components/ui';
import { date, rwf } from '@/lib/format';

interface Summary {
  vehicle?: { make?: string; model?: string; plate?: string } | null;
  financing?: { balance?: number; nextDueAmount?: number; nextDueDate?: string } | null;
}

export function ClientHome() {
  const { user } = useAuth();
  const { data, loading, error, notConnected } = useApi<Summary>('/financing/my');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">
          Welcome{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="text-sm text-ink-soft">Your vehicle, payments and charging in one place.</p>
      </div>

      {loading && <Spinner />}
      {notConnected && <NotConnected what="Your financing summary" />}
      {error && <Notice>{error}</Notice>}

      {!loading && !error && !notConnected && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Vehicle"
              value={data?.vehicle?.plate ?? '—'}
              hint={[data?.vehicle?.make, data?.vehicle?.model].filter(Boolean).join(' ') || undefined}
            />
            <Stat label="Balance" value={rwf(data?.financing?.balance)} />
            <Stat
              label="Next payment"
              value={rwf(data?.financing?.nextDueAmount)}
              hint={data?.financing?.nextDueDate ? `Due ${date(data.financing.nextDueDate)}` : undefined}
            />
          </div>

          {!data?.vehicle && (
            <Card title="Getting started">
              <Empty>
                No vehicle is linked to this account yet. Once your financing is approved
                and the vehicle is registered, it appears here.
              </Empty>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
