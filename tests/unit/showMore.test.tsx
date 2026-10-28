import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ShowMore } from '@/components/ShowMore';

// jsdom has no layout: pretend the content is a given height.
function contentHeight(px: number) {
  return vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(px);
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('View more / View less', () => {
  it('shows no button when everything already fits', () => {
    contentHeight(100);
    render(<ShowMore storageKey="k1">Short text</ShowMore>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('collapses long content, opens and closes it, and remembers the choice', () => {
    contentHeight(900);
    const { unmount } = render(
      <ShowMore storageKey="k2" collapsedRem={10}>
        Long text
      </ShowMore>,
    );
    const button = screen.getByRole('button', { name: 'View more' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'View less' })).toHaveAttribute('aria-expanded', 'true');
    expect(localStorage.getItem('k2')).toBe('open');
    unmount();

    // Next visit: still open.
    render(<ShowMore storageKey="k2">Long text</ShowMore>);
    expect(screen.getByRole('button', { name: 'View less' })).toBeInTheDocument();
  });

  it('opens by itself when the keyboard moves into the hidden part', () => {
    contentHeight(900);
    render(
      <ShowMore storageKey="k3">
        <a href="#x">A link further down</a>
      </ShowMore>,
    );
    act(() => screen.getByRole('link').focus());
    expect(screen.getByRole('button', { name: 'View less' })).toBeInTheDocument();
  });
});
