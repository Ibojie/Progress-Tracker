import { formatHex, interpolate, wcagContrast } from 'culori';
import { daysBetween } from './dates';
import type { EngineGoal, IsoDate } from './types';

export type Band = 'long' | 'medium' | 'short' | 'immediate' | 'overdue';
export type Theme = 'light' | 'dark';

export interface BandColor {
  band: Band;
  bg: string;
  fg: string;
}

export const BAND_LABEL: Record<Band, string> = {
  long: 'Long Term',
  medium: 'Medium Term',
  short: 'Short Term',
  immediate: 'Immediate',
  overdue: 'Overdue',
};

/** Text colours tried against every background; the one with more contrast wins. */
export const TEXT_DARK = '#0F172A';
export const TEXT_LIGHT = '#FFFFFF';
/** Used when neither reaches AA. Black vs white always gives at least 4.58:1 on some side. */
export const TEXT_BLACK = '#000000';
const AA = 4.5;

interface Gradient {
  /** Days left at the light ("far") end; values above are clamped. */
  farDays: number;
  /** Days left at the deep ("near") end. */
  nearDays: number;
  far: Record<Theme, string>;
  near: string;
}

// §5: colour gets denser as days left approach the band's lower bound.
// In dark mode the far edge is a dark tint instead of a pale one (§10.1).
const GRADIENTS: Record<Exclude<Band, 'overdue'>, Gradient> = {
  long: { farDays: 100, nearDays: 60, far: { light: '#FFFFFF', dark: '#1E2430' }, near: '#4A4A4A' },
  medium: { farDays: 59, nearDays: 30, far: { light: '#E3F0FF', dark: '#0F1D36' }, near: '#0B4FA8' },
  short: { farDays: 29, nearDays: 15, far: { light: '#FFF3D6', dark: '#2A1E08' }, near: '#B86E00' },
  immediate: { farDays: 14, nearDays: 0, far: { light: '#FFE0DC', dark: '#2C1311' }, near: '#B3261E' },
};
const OVERDUE_BG = '#5C0B0B';

export function bandFor(daysLeft: number): Band {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 14) return 'immediate';
  if (daysLeft <= 29) return 'short';
  if (daysLeft <= 59) return 'medium';
  return 'long';
}

/** Near-black or white, whichever contrasts more with `bg`; pure black when neither reaches AA (4.5:1). */
export function readableTextOn(bg: string): string {
  const dark = wcagContrast(bg, TEXT_DARK);
  const light = wcagContrast(bg, TEXT_LIGHT);
  if (Math.max(dark, light) >= AA) return dark >= light ? TEXT_DARK : TEXT_LIGHT;
  return wcagContrast(bg, TEXT_BLACK) >= light ? TEXT_BLACK : TEXT_LIGHT;
}

export function contrastRatio(a: string, b: string): number {
  return wcagContrast(a, b);
}

export function bandColor(daysLeft: number, theme: Theme = 'light'): BandColor {
  const band = bandFor(daysLeft);
  if (band === 'overdue') return { band, bg: OVERDUE_BG, fg: readableTextOn(OVERDUE_BG) };

  const g = GRADIENTS[band];
  const clamped = Math.min(Math.max(daysLeft, g.nearDays), g.farDays);
  const t = (g.farDays - clamped) / (g.farDays - g.nearDays); // 0 at the far edge, 1 at the near edge
  // OKLCH keeps the steps perceptually even (§5).
  const bg = formatHex(interpolate([g.far[theme], g.near], 'oklch')(t)) ?? g.near;
  return { band, bg: bg.toUpperCase(), fg: readableTextOn(bg) };
}

/** Days left until the nearest unfinished goal is due; null when every goal is done (§5). */
export function elementDaysLeft(goals: readonly EngineGoal[], today: IsoDate): number | null {
  let nearest: number | null = null;
  for (const g of goals) {
    if (g.isDone) continue;
    const d = daysBetween(today, g.dueDate);
    if (nearest === null || d < nearest) nearest = d;
  }
  return nearest;
}
