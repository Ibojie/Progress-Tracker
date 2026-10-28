import { afterEach, describe, expect, it, vi } from 'vitest';
import { completesElement } from '@/features/elements/api';
import { celebrate } from '@/lib/celebrate';
import type { ElementWithGoals } from '@/features/elements/model';

const rows = (done: boolean[]) =>
  [{ id: 'e', goals: done.map((d, i) => ({ id: `g${i}`, is_done: d })) }] as unknown as ElementWithGoals[];

describe('confetti when an element reaches 100%', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fires only for the tick that finishes the element', () => {
    expect(completesElement(rows([true, true, false]), 'g2')).toBe(true);
    expect(completesElement(rows([true, false, false]), 'g2')).toBe(false);
    expect(completesElement(rows([false]), 'g0')).toBe(true);
    expect(completesElement(rows([true]), 'missing')).toBe(false);
    expect(completesElement(undefined, 'g0')).toBe(false);
  });

  it('still celebrates when the device asks for reduced motion (the calm version)', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ scale() {} } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const append = vi.spyOn(document.body, 'appendChild');
    celebrate();
    expect(append).toHaveBeenCalledTimes(1);
    (append.mock.calls[0]![0] as HTMLElement).remove();
    vi.unstubAllGlobals();
  });
});
