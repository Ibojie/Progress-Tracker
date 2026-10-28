import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function readOpen(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'open';
  } catch {
    return false;
  }
}

function saveOpen(key: string, open: boolean): void {
  try {
    localStorage.setItem(key, open ? 'open' : 'closed');
  } catch {
    // Storage blocked: the card just starts collapsed next time.
  }
}

/**
 * Shows the first part of long content with a "View more" button, and "View less" once open.
 * The button only appears when the content is actually taller than the collapsed height, and
 * the choice is remembered on this device. Tabbing into the hidden part opens it, so nothing
 * is unreachable by keyboard.
 */
export function ShowMore({
  children,
  storageKey,
  collapsedRem = 14,
  className,
}: {
  children: ReactNode;
  /** Remembers this card's choice on the device. */
  storageKey: string;
  /** How much is visible while collapsed. */
  collapsedRem?: number;
  className?: string;
}) {
  const id = useId();
  const inner = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(() => readOpen(storageKey));
  const [overflows, setOverflows] = useState(false);

  // Re-measure whenever the content or the screen width changes.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const limit = collapsedRem * parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
    const measure = () => setOverflows(el.scrollHeight > limit + 8);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [collapsedRem, children]);

  useEffect(() => saveOpen(storageKey, open), [storageKey, open]);

  const clipped = overflows && !open;

  return (
    <div className={className}>
      <div
        id={id}
        className={cn(clipped && 'overflow-hidden')}
        style={
          clipped
            ? {
                maxHeight: `${collapsedRem}rem`,
                // Fades the last lines out, whatever the card's (glass) background is.
                maskImage: 'linear-gradient(to bottom, black 65%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent)',
              }
            : undefined
        }
        onFocusCapture={() => clipped && setOpen(true)}
      >
        <div ref={inner}>{children}</div>
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="mt-3 inline-flex min-h-tap items-center gap-1.5 rounded-md px-2 font-semibold text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {open ? <ChevronUp aria-hidden className="size-5" /> : <ChevronDown aria-hidden className="size-5" />}
          {open ? 'View less' : 'View more'}
        </button>
      )}
    </div>
  );
}
