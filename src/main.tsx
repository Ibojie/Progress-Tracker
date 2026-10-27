import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { App } from './App';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import { NoticeProvider } from '@/components/Notice';
import { OFFLINE_MAX_AGE, queryClient } from '@/lib/queryClient';
import { CACHE_BUSTER, persister } from '@/lib/offlineStorage';
import { listenForInstallPrompt } from '@/features/pwa/install';
import './styles/index.css';

// TanStack Query assumes it starts online and only listens for later changes. Opening the app
// already offline must keep queued changes paused, not send (and lose) them.
onlineManager.setOnline(navigator.onLine);

// Catch the browser's install offer as early as possible; it fires once, soon after load.
listenForInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: OFFLINE_MAX_AGE, buster: CACHE_BUSTER }}
        // After the saved copy loads, send any changes queued in an earlier session.
        onSuccess={() => void queryClient.resumePausedMutations()}
      >
        <AuthProvider>
          <NoticeProvider>
            <App />
          </NoticeProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
