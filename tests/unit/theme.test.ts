import { describe, expect, it, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredPreference,
  resolveTheme,
  toggledPreference,
  writeStoredPreference,
} from '@/lib/theme/theme';

describe('resolveTheme', () => {
  it('follows the device when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('an explicit choice wins over the device', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('toggledPreference', () => {
  it('flips the theme currently shown', () => {
    expect(toggledPreference('light')).toBe('dark');
    expect(toggledPreference('dark')).toBe('light');
  });
});

describe('stored preference', () => {
  it('reads valid values and ignores junk', () => {
    expect(readStoredPreference({ getItem: () => 'dark' })).toBe('dark');
    expect(readStoredPreference({ getItem: () => 'purple' })).toBeNull();
    expect(readStoredPreference({ getItem: () => null })).toBeNull();
    expect(readStoredPreference(undefined)).toBeNull();
  });
  it('survives storage that throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredPreference(throwing)).toBeNull();
    expect(() => writeStoredPreference(throwing, 'dark')).not.toThrow();
  });
  it('writes under the key the inline script reads', () => {
    const setItem = vi.fn();
    writeStoredPreference({ setItem }, 'system');
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'system');
  });
});

describe('applyTheme', () => {
  it('sets data-theme and the theme-color meta tag', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000">';
    applyTheme(document, 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b1120');
  });
});

describe('index.html no-flash script', () => {
  it('uses the same storage key as theme.ts', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });
});
