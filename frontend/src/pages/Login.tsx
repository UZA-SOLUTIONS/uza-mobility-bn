import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { landingPathFor } from '@/portals/registry';
import { Button, Field, Notice } from '@/components/ui';
import { errorMessage } from '@/api/client';

export function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? landingPathFor(user.roles) ?? '/no-access'} replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      // Never distinguish "no such account" from "wrong password" — that turns the
      // form into a way of asking whether a given person banks with UZA.
      setError(errorMessage(err, 'Those details did not work. Please check and try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6">
        <div>
          <h1 className="text-xl font-semibold">UZA Mobility</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to continue.</p>
        </div>
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </div>
  );
}

export function NoAccess() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">No portal is assigned to this account</h1>
      <p className="max-w-md text-sm text-ink-soft">
        {user?.email} is signed in but has no role that opens a portal. Ask an
        administrator to assign one.
      </p>
      <Button variant="quiet" onClick={() => void logout()}>Sign out</Button>
    </div>
  );
}
