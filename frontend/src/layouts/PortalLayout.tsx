import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useAuth } from '@/auth/useAuth';
import { portalsFor, type PortalDefinition } from '@/portals/registry';
import { env } from '@/lib/env';
import { ChatBot } from '@/components/ChatBot';

export function PortalLayout({ portal }: { portal: PortalDefinition }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const others = portalsFor(user?.roles ?? []).filter((p) => p.key !== portal.key);
  const accent = `var(--color-${portal.accent})`;

  return (
    <div className="flex min-h-full">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 shrink-0 border-r border-line bg-surface p-4
                    transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-6 flex items-center gap-2">
          <portal.icon size={20} style={{ color: accent }} />
          <div>
            <div className="text-sm font-semibold leading-tight">{portal.name}</div>
            <div className="text-xs text-ink-soft">UZA Mobility</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {portal.nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === portal.basePath}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-brand-soft font-medium' : 'hover:bg-brand-soft'
                }`
              }
              style={({ isActive }) => (isActive ? { color: accent } : undefined)}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {others.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <div className="mb-2 px-3 text-xs uppercase tracking-wide text-ink-soft">Switch to</div>
            {others.map((p) => (
              <button
                key={p.key}
                onClick={() => { setOpen(false); navigate(p.basePath); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-brand-soft"
              >
                <p.icon size={16} />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <FiX /> : <FiMenu />}
          </button>
          {/* Nobody should demonstrate staging believing it is production. */}
          {!env.isProduction && (
            <span className="rounded bg-warn px-2 py-0.5 text-xs font-medium text-white">
              {env.environment}
            </span>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-ink-soft sm:inline">{user?.email}</span>
            <button onClick={() => void logout()} className="flex items-center gap-1.5 hover:underline">
              <FiLogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>

        <ChatBot portalKey={portal.key} />
      </div>
    </div>
  );
}
