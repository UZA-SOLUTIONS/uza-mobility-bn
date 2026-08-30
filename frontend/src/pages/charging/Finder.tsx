import { useEffect, useState } from 'react';
import { FiMapPin, FiNavigation, FiZap } from 'react-icons/fi';
import { api, errorMessage } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Empty, Notice, Pill, Spinner } from '@/components/ui';
import { countdown, rwf } from '@/lib/format';

interface Station {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  availablePorts?: number | null;
  totalPorts?: number | null;
  pricePerKwh?: number | null;
}

interface Hold {
  id: string;
  stationId: string;
  expiresAt: string;
}

/**
 * Find a charger, then hold a connector.
 *
 * The hold is the part that matters. A driver who has committed to a twenty-minute
 * drive across Kigali needs the socket to still be there on arrival, and the station
 * owner needs an abandoned hold to release itself rather than idle all afternoon.
 * The API owns both rules; this screen shows the clock so the driver can see it too.
 */
export function ChargingFinder() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const path = coords
    ? `/charging-stations/nearby?latitude=${coords.lat}&longitude=${coords.lng}&radiusKm=15`
    : '/charging-stations';
  const { data, loading, error, reload } = useApi<Station[] | { items: Station[] }>(path);
  const stations = Array.isArray(data) ? data : (data?.items ?? []);

  function locate() {
    if (!navigator.geolocation) {
      setLocateError('This browser cannot share a location. Showing all stations instead.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      // Refusing to share a location is a normal choice, not a failure. The full
      // list still works; it is only unsorted by distance.
      () => { setLocateError('Location not shared. Showing all stations instead.'); setLocating(false); },
      { timeout: 8000 },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Find a charger</h1>
        <Button variant="quiet" onClick={locate} disabled={locating}>
          <span className="flex items-center gap-1.5"><FiNavigation size={14} />{locating ? 'Locating…' : 'Near me'}</span>
        </Button>
      </div>

      {locateError && <Notice tone="neutral">{locateError}</Notice>}
      {error && <Notice>{error}</Notice>}
      {loading && <Spinner label="Loading stations" />}
      {!loading && !error && stations.length === 0 && <Empty>No charging stations are listed yet.</Empty>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((s) => <StationCard key={s.id} station={s} onChange={reload} />)}
      </div>
    </div>
  );
}

function StationCard({ station, onChange }: { station: Station; onChange: () => void }) {
  const [hold, setHold] = useState<Hold | null>(null);
  const [remaining, setRemaining] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The countdown is derived from the expiry on every tick rather than decremented.
  // A decrementing counter drifts when the tab is backgrounded and then tells the
  // driver they have time they do not have.
  useEffect(() => {
    if (!hold) return;
    const id = setInterval(() => {
      const left = countdown(hold.expiresAt);
      setRemaining(left);
      if (left === 'expired') { setHold(null); onChange(); }
    }, 1000);
    return () => clearInterval(id);
  }, [hold, onChange]);

  const free = station.availablePorts ?? 0;

  async function book() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<Hold>(`/charging-stations/${station.id}/holds`, {});
      setHold(data);
      setRemaining(countdown(data.expiresAt));
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 404
        ? 'Slot holds are not enabled in this environment yet.'
        : errorMessage(e, 'Could not hold a connector.'));
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    if (!hold) return;
    setBusy(true);
    try {
      await api.delete(`/charging-stations/holds/${hold.id}`);
    } catch {
      /* the hold expires on its own regardless */
    } finally {
      setHold(null);
      setBusy(false);
      onChange();
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{station.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-soft">
            <FiMapPin size={13} />
            {station.address ?? station.city ?? 'Location not listed'}
            {station.distanceKm != null && ` · ${station.distanceKm.toFixed(1)} km`}
          </p>
        </div>
        <Pill tone={free > 0 ? 'good' : 'bad'}>
          {free > 0 ? `${free} free` : 'Full'}
        </Pill>
      </div>

      <dl className="tabular mt-3 flex gap-5 text-sm">
        <div>
          <dt className="text-xs text-ink-soft">Connectors</dt>
          <dd>{station.totalPorts ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Per kWh</dt>
          <dd>{station.pricePerKwh != null ? rwf(station.pricePerKwh) : '—'}</dd>
        </div>
      </dl>

      {error && <div className="mt-3"><Notice>{error}</Notice></div>}

      <div className="mt-4 flex items-center gap-3">
        {hold ? (
          <>
            <Pill tone="warn">Held · {remaining}</Pill>
            <Button variant="quiet" onClick={() => void release()} disabled={busy}>Release</Button>
          </>
        ) : (
          <Button onClick={() => void book()} disabled={busy || free === 0}>
            <span className="flex items-center gap-1.5"><FiZap size={14} />Hold a connector</span>
          </Button>
        )}
      </div>
    </Card>
  );
}
