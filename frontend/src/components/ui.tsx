import type { ReactNode } from 'react';

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold tracking-wide uppercase text-ink-soft">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'good' | 'warn' | 'bad';
const TONE: Record<Tone, string> = {
  neutral: 'bg-brand-soft text-brand',
  good: 'text-white bg-good',
  warn: 'text-white bg-warn',
  bad: 'text-white bg-bad',
};

/** State reads at a glance, not by reading the number. */
export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}>{children}</span>;
}

export function Button({
  children, onClick, type = 'button', variant = 'primary', disabled,
}: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit';
  variant?: 'primary' | 'quiet'; disabled?: boolean;
}) {
  const base = 'rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const style = variant === 'primary'
    ? 'bg-brand text-white hover:opacity-90'
    : 'border border-line hover:bg-brand-soft';
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

export function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        {...input}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
    </label>
  );
}

export function Notice({ tone = 'bad', children }: { tone?: Tone; children: ReactNode }) {
  const color = tone === 'bad' ? 'text-bad' : 'text-ink-soft';
  return <p role="alert" className={`text-sm ${color}`}>{children}</p>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-ink-soft">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}…
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="p-6 text-sm text-ink-soft">{children}</p>;
}

/**
 * Shown where an endpoint is not deployed in this environment.
 *
 * It is deliberately not styled as an error. Nothing is broken — the screen is
 * ahead of its API, which is a normal state during a staged rollout and should
 * read as one.
 */
export function NotConnected({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-6 text-sm text-ink-soft">
      <p className="font-medium text-ink">{what} is not connected in this environment.</p>
      <p className="mt-1">
        The screen is built and the request is correct. It will fill in when the API
        for it is deployed — nothing here is placeholder data.
      </p>
    </div>
  );
}
