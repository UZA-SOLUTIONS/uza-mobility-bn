/**
 * Where the tokens live.
 *
 * The access token is held in memory only. A token in localStorage is readable by
 * any script that gets onto the page, and this application shows loan files.
 * Losing the session on a page refresh is the price, and the refresh token pays it.
 *
 * The refresh token is in localStorage because it has to survive a reload to be
 * worth having. It is single-use and rotated by the API on every exchange, so a
 * stolen one is detectable and short-lived. If the threat model tightens, the
 * replacement is an httpOnly cookie set by the API — and only this file changes.
 */
const REFRESH_KEY = 'uza.refreshToken';

let accessToken: string | null = null;

export const tokens = {
  getAccess: () => accessToken,
  setAccess: (t: string | null) => {
    accessToken = t;
  },

  getRefresh: (): string | null => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      // Private mode, or storage disabled. Treat it as logged out rather than crashing.
      return null;
    }
  },
  setRefresh: (t: string | null) => {
    try {
      if (t) localStorage.setItem(REFRESH_KEY, t);
      else localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* nothing to do; the session just will not survive a reload */
    }
  },

  clear: () => {
    accessToken = null;
    tokens.setRefresh(null);
  },
};
