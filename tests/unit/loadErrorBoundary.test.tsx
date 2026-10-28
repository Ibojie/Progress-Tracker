import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadErrorBoundary } from '@/components/LoadErrorBoundary';
import { isChunkLoadError } from '@/lib/chunkReload';

function Boom({ error }: { error: Error }): never {
  throw error;
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('a screen that fails to load', () => {
  it('recognises a file that vanished after an update', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/TimelinePage-x.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('shows "A new version is ready" with a Reload button instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // The first failure reloads once by itself; pretend that already happened.
    sessionStorage.setItem('pt-chunk-reloaded', '1');
    render(
      <LoadErrorBoundary>
        <Boom error={new TypeError('Failed to fetch dynamically imported module: /assets/x.js')} />
      </LoadErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('A new version is ready');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('shows a general message for other crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <LoadErrorBoundary>
        <Boom error={new Error('bug')} />
      </LoadErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
