import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { cn } from '@/lib/utils';

/** Sun/moon switch: one tap flips between light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cn(
        'group inline-flex min-h-tap min-w-tap cursor-pointer items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <span className="relative flex h-8 w-14 items-center rounded-full border border-border/60 bg-muted/80 transition-colors">
        <Sun aria-hidden className="absolute left-1.5 size-4 text-amber-600" />
        <Moon aria-hidden className="absolute right-1.5 size-4 text-indigo-300" />
        <span
          aria-hidden
          className={cn(
            'absolute left-0.5 flex size-7 items-center justify-center rounded-full bg-surface shadow-md transition-transform duration-200',
            isDark && 'translate-x-6',
          )}
        >
          {isDark ? <Moon className="size-4 text-primary" /> : <Sun className="size-4 text-amber-600" />}
        </span>
      </span>
    </button>
  );
}
