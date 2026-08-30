import { useApi } from '@/hooks/useApi';
import { Card, Empty, NotConnected, Notice, Pill, Spinner } from '@/components/ui';
import { date } from '@/lib/format';

interface JobCard {
  id: string;
  reference?: string;
  vehiclePlate?: string;
  state?: string;
  promisedAt?: string;
  assignedTo?: string | null;
}

/**
 * The workshop board.
 *
 * Ordered by what will go wrong first, not by when it arrived: overdue, then at
 * risk, then waiting on a decision somebody else owes. A board sorted by arrival
 * time is a board that lets a promised car slip quietly.
 */
const LANES = [
  { key: 'OVERDUE', label: 'Overdue', tone: 'bad' as const },
  { key: 'AT_RISK', label: 'At risk', tone: 'warn' as const },
  { key: 'AWAITING_AUTHORISATION', label: 'Awaiting authorisation', tone: 'warn' as const },
  { key: 'AWAITING_PARTS', label: 'Awaiting parts', tone: 'neutral' as const },
  { key: 'IN_PROGRESS', label: 'In progress', tone: 'neutral' as const },
];

export function WorkshopBoard() {
  const { data, loading, error, notConnected } = useApi<JobCard[] | { items: JobCard[] }>('/workshop/job-cards');
  const cards = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Workshop board</h1>
      {loading && <Spinner />}
      {notConnected && <NotConnected what="The workshop board" />}
      {error && <Notice>{error}</Notice>}
      {!loading && !error && cards.length === 0 && (
        <Card><Empty>No job cards are open.</Empty></Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {LANES.map((lane) => {
          const lanes = cards.filter((c) => (c.state ?? '').toUpperCase() === lane.key);
          return (
            <Card key={lane.key} title={`${lane.label} (${lanes.length})`}>
              {lanes.length === 0 && <p className="text-sm text-ink-soft">Clear</p>}
              <ul className="space-y-2">
                {lanes.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.vehiclePlate ?? c.reference ?? c.id}</span>
                      <Pill tone={lane.tone}>{lane.label}</Pill>
                    </div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {c.assignedTo ?? 'Unassigned'} · promised {date(c.promisedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
