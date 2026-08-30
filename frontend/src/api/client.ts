import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { env } from '@/lib/env';
import { tokens } from './tokens';

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const t = tokens.getAccess();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

/**
 * One refresh at a time.
 *
 * A dashboard fires six requests at once. If the access token has expired, all six
 * get a 401 together — and six parallel refreshes with a single-use rotating token
 * means five of them fail and log the user out mid-session. So the first 401 starts
 * the refresh and the rest wait on the same promise.
 */
let refreshing: Promise<string> | null = null;

/** Set by AuthProvider so a dead session clears React state, not just the tokens. */
let onSessionLost: () => void = () => {};
export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokens.getRefresh();
  if (!refreshToken) throw new Error('no refresh token');

  // A bare axios call, not `api` — otherwise a 401 on the refresh route recurses.
  // The refresh token travels in the Authorization header, not the body — that is
  // the API's contract, and sending it in the body fails with a 401 that looks
  // exactly like an expired session.
  //
  // A bare axios call also means no interceptor runs, so unwrap the envelope by hand.
  const res = await axios.post(
    `${env.apiBaseUrl}/auth/refresh`,
    {},
    { withCredentials: true, headers: { Authorization: `Bearer ${refreshToken}` } },
  );
  const data = unwrapEnvelope(res.data) as { accessToken: string; refreshToken: string };

  tokens.setAccess(data.accessToken);
  tokens.setRefresh(data.refreshToken);
  return data.accessToken;
}

/**
 * Unwrap the API envelope.
 *
 * Every successful response is `{ success: true, data: <payload> }` and every failure
 * is `{ success: false, error: { message } }`. Doing this in one interceptor means no
 * screen ever writes `res.data.data`, and swapping the envelope later is this function
 * rather than every call site.
 *
 * The check is deliberately narrow — an object carrying `success` and `data` — so an
 * endpoint that legitimately returns a payload with a `data` field of its own is not
 * silently unwrapped twice.
 */
function unwrapEnvelope(payload: unknown): unknown {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload &&
    typeof (payload as { success: unknown }).success === 'boolean'
  ) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

api.interceptors.response.use(
  (r) => {
    r.data = unwrapEnvelope(r.data);
    return r;
  },
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;

    const isRefreshCall = original?.url?.includes('/auth/refresh');
    if (status !== 401 || !original || original._retried || isRefreshCall) {
      return Promise.reject(error);
    }

    original._retried = true;
    try {
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const fresh = await refreshing;
      original.headers = { ...original.headers, Authorization: `Bearer ${fresh}` };
      return api.request(original);
    } catch {
      tokens.clear();
      onSessionLost();
      return Promise.reject(error);
    }
  },
);

/**
 * The message to show a person when a request fails.
 *
 * The API returns `{ message: string | string[] }` from the global validation pipe.
 * Anything else — a network drop, a proxy error page — must not reach the screen as
 * raw text, so it collapses to something a driver can act on.
 */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return 'Cannot reach the server. Check your connection.';

    // Status-driven wording first. Some framework errors put an exception class name
    // in `message` — "ThrottlerException: Too Many Requests" is not something to show
    // a driver, and reading the body before checking the status is how it gets shown.
    const status = e.response.status;
    if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (status === 403) return 'You do not have access to that.';
    if (status >= 500) return 'The server had a problem. Please try again shortly.';

    const body = e.response.data as
      | { message?: string | string[]; error?: { message?: string } }
      | undefined;
    const m = body?.error?.message ?? body?.message;
    if (Array.isArray(m)) return m.join(', ');
    // Anything that looks like a class name rather than a sentence is for the log,
    // not the screen.
    if (typeof m === 'string' && m.trim() && !/^[A-Z]\w*(Exception|Error):/.test(m)) return m;
  }
  return fallback;
}
