import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface NoticeContextValue {
  notify: (message: string) => void;
}

const NoticeContext = createContext<NoticeContextValue>({ notify: () => {} });

// Lets code outside React (the offline queue) show a message.
let globalNotify: ((message: string) => void) | null = null;
// eslint-disable-next-line react-refresh/only-export-components
export function notifyGlobally(message: string): void {
  globalNotify?.(message);
}

/** A single, screen-reader-announced message bar for save errors and confirmations. */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const notify = useCallback((m: string) => setMessage(m), []);
  globalNotify = notify;
  return (
    <NoticeContext.Provider value={{ notify }}>
      {children}
      <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
        {message && (
          <div role="alert" className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-md bg-foreground px-4 py-3 text-background shadow-xl">
            <p className="text-secondary">{message}</p>
            <button
              type="button"
              onClick={() => setMessage(null)}
              aria-label="Dismiss message"
              className="-m-2 inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        )}
      </div>
    </NoticeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotice(): NoticeContextValue {
  return useContext(NoticeContext);
}
