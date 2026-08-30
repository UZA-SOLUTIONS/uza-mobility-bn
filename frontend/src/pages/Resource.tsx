import { useApi } from '@/hooks/useApi';
import { Card, Empty, NotConnected, Notice, Pill, Spinner } from '@/components/ui';
import { date, rwf } from '@/lib/format';

export interface Column<T> {
  header: string;
  /** Cell renderer. Given the row, returns what to show. */
  cell: (row: T) => React.ReactNode;
  /** Right-align and tabular-figure this column. Use for money and counts. */
  numeric?: boolean;
}

/**
 * A list screen built from a path and a column set.
 *
 * Most of the 219 endpoints are "fetch a collection, show it as rows". Writing that
 * screen by hand 40 times produces 40 slightly different loading states and 40
 * places for an `undefined.map` to hide. Anything that needs more than a table
 * stops using this and writes a real component — that is the intended exit, not a
 * failure of the abstraction.
 */
export function ResourceList<T extends { id?: string | number }>({
  title, path, columns, empty = 'Nothing here yet.',
}: {
  title: string;
  path: string;
  columns: Column<T>[];
  empty?: string;
}) {
  const { data, loading, error, notConnected } = useApi<T[] | { items: T[]; total?: number }>(path);
  const rows: T[] = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      <Card>
        {loading && <Spinner />}
        {notConnected && <NotConnected what={title} />}
        {error && <Notice>{error}</Notice>}
        {!loading && !error && !notConnected && rows.length === 0 && <Empty>{empty}</Empty>}
        {rows.length > 0 && (
          // The table scrolls inside its own box. The page body must never scroll
          // sideways — on a phone that hides the navigation.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  {columns.map((c) => (
                    <th key={c.header} className={`pb-2 pr-4 font-medium ${c.numeric ? 'text-right' : ''}`}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id ?? i} className="border-b border-line last:border-0">
                    {columns.map((c) => (
                      <td key={c.header} className={`py-2.5 pr-4 ${c.numeric ? 'tabular text-right' : ''}`}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* Cell helpers, so formatting is decided once. */
export const cells = {
  text: (v: unknown) => (v == null || v === '' ? '—' : String(v)),
  money: (v: unknown) => rwf(typeof v === 'number' ? v : null),
  when: (v: unknown) => date(typeof v === 'string' ? v : null),
  status: (v: unknown) => {
    const s = String(v ?? '').toUpperCase();
    const tone = /COMPLETE|ACTIVE|APPROVED|PAID|DELIVERED/.test(s) ? 'good'
      : /OVERDUE|REJECT|FAIL|CANCEL|ARREARS/.test(s) ? 'bad'
      : /PENDING|AWAIT|REVIEW|HOLD/.test(s) ? 'warn' : 'neutral';
    return s ? <Pill tone={tone}>{s.replace(/_/g, ' ')}</Pill> : '—';
  },
};
