import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError, markLoadedOk, reloadOnceForNewVersion } from '@/lib/chunkReload';

interface State {
  error: unknown;
}

/**
 * Catches a screen that fails to load (or crashes) instead of leaving a blank page. A file that
 * vanished after an update reloads the app once; anything else shows a message with a Reload button.
 */
export class LoadErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Screen failed', error, info.componentStack);
    if (isChunkLoadError(error)) reloadOnceForNewVersion();
  }

  componentDidMount() {
    markLoadedOk();
  }

  render() {
    if (!this.state.error) return this.props.children;
    const update = isChunkLoadError(this.state.error);
    return (
      <div role="alert" className="page-shell grid gap-3 py-10">
        <h1 className="text-h2 font-semibold">{update ? 'A new version is ready' : 'Something went wrong'}</h1>
        <p className="max-w-prose text-muted-foreground">
          {update
            ? 'Progress Tracker was updated while it was open. Reload to continue; your saved changes are kept.'
            : 'This screen hit a problem. Reloading usually fixes it; changes made offline are kept.'}
        </p>
        <div>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden /> Reload
          </Button>
        </div>
      </div>
    );
  }
}
