import { NavLink, Outlet } from 'react-router-dom';
import { Target } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OfflineBanner } from '@/features/pwa/OfflineBanner';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav';

function Brand() {
  return (
    <span className="flex items-center gap-2 font-bold">
      <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
        <Target aria-hidden className="size-5" />
      </span>
      Progress Tracker
    </span>
  );
}

/** Mobile: header + bottom tab bar. Desktop (lg+): left sidebar + top bar. */
export function AppShell() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <aside className="glass sticky top-0 hidden h-dvh flex-col gap-6 rounded-none border-y-0 border-l-0 p-4 lg:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
        <nav aria-label="Main">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-tap items-center gap-3 rounded-md px-3 py-2 font-medium no-underline transition-colors hover:bg-muted',
                      isActive && 'bg-primary text-primary-foreground hover:bg-primary',
                    )
                  }
                >
                  <Icon aria-hidden className="size-5" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-30">
        <header className="glass flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-1 pt-[max(0.25rem,env(safe-area-inset-top))]">
          <span className="lg:invisible">
            <Brand />
          </span>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <OfflineBanner />
        </div>

        <main id="main" className="page-shell flex-1 py-6 pb-28 lg:pb-10">
          <Outlet />
        </main>

        <nav
          aria-label="Main"
          className="glass fixed inset-x-0 bottom-0 z-30 rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="grid grid-cols-5">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[1rem] font-medium leading-tight text-muted-foreground no-underline',
                      isActive && 'text-primary',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon aria-hidden className={cn('size-6', isActive && 'stroke-[2.5]')} />
                      <span className="max-[360px]:sr-only">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
