import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Spinner } from '@/components/ui';
import type { PortalDefinition } from '@/portals/registry';

/**
 * The route guard.
 *
 * It is a convenience, not a control. Every one of these rules is also enforced by
 * the API, which is the only place enforcement counts — hiding a link stops an
 * honest person clicking it and stops nobody else. What this buys is that a lender
 * never sees a screen full of errors it was never meant to load.
 */
export function RequirePortal({ portal }: { portal: PortalDefinition }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const allowed = portal.roles.some((r) => user.roles.includes(r));
  if (!allowed) return <Navigate to="/no-access" replace />;

  return <Outlet />;
}

/** Signed in, any portal. For pages that belong to the person rather than a role. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
