import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/api/client';

interface Result<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /**
   * The endpoint is not deployed in this environment — a 404 on a collection, not
   * a failure of this screen.
   *
   * Parts of the platform are UI-first: the workshop's rules exist as tested code
   * with no HTTP surface yet, and the lender endpoints are not written. A screen in
   * that state must say so calmly. Showing "Cannot GET /workshop/job-cards" in red
   * trains everyone to ignore red, and the next message will be a real one.
   */
  notConnected: boolean;
  reload: () => void;
}

/**
 * GET a path, with the three states every screen needs.
 *
 * Deliberately small. A screen that has loaded, is loading, or has failed are three
 * different screens, and code that pretends otherwise renders `undefined.map` at
 * some point. Swap this for TanStack Query when caching starts to matter; the
 * signature is the same shape on purpose.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []): Result<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotConnected(false);
    api.get<T>(path)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => {
        if (cancelled) return;
        const status = (e as { response?: { status?: number } }).response?.status;
        if (status === 404) setNotConnected(true);
        else setError(errorMessage(e));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, notConnected, reload };
}
