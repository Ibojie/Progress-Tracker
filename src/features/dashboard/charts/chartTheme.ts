import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme/ThemeProvider';

/**
 * Chart colours and type for each theme. Category colours use the validated categorical order
 * (dataviz skill: blue, orange, aqua, yellow); dark mode uses that palette's dark steps.
 * The current period is the first category hue; the previous period is a muted grey.
 */
export interface ChartTheme {
  text: string;
  muted: string;
  grid: string;
  tooltipBg: string;
  surface: string;
  categories: [string, string, string, string];
  current: string;
  previous: string;
  ideal: string;
  fontSize: number;
  axisFontSize: number;
  /** Phone-width screen (≤ 760px): legends go below, bar charts turn horizontal. */
  compact: boolean;
}

const LIGHT: Omit<ChartTheme, 'fontSize' | 'axisFontSize' | 'compact'> = {
  text: '#0F172A',
  muted: '#475569',
  grid: 'rgba(15, 23, 42, 0.12)',
  tooltipBg: '#FFFFFF',
  surface: '#FFFFFF',
  categories: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100'],
  current: '#2A78D6',
  previous: '#64748B', // slate-500: 4.8:1 on white (chart marks need 3:1)
  ideal: '#475569',
};

const DARK: Omit<ChartTheme, 'fontSize' | 'axisFontSize' | 'compact'> = {
  text: '#F1F5F9',
  muted: '#B0BED0',
  grid: 'rgba(241, 245, 249, 0.14)',
  tooltipBg: '#161E30',
  surface: '#161E30',
  categories: ['#3987E5', '#D95926', '#199E70', '#C98500'],
  current: '#3987E5',
  previous: '#94A3B8', // 6:1 on the dark surface
  ideal: '#B0BED0',
};

const PHONE = '(max-width: 760px)';

/** Theme-aware chart tokens; text is 16px on phones and 14px (axis 13px) on desktop. */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE).matches);
  useEffect(() => {
    const mql = window.matchMedia?.(PHONE);
    if (!mql) return;
    const on = (e: MediaQueryListEvent) => setPhone(e.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return { ...(theme === 'dark' ? DARK : LIGHT), fontSize: phone ? 16 : 14, axisFontSize: phone ? 16 : 13, compact: phone };
}

/** Shared tooltip, legend and axis styling. */
export function baseOption(t: ChartTheme) {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: t.text, fontSize: t.fontSize, fontFamily: 'Inter Variable, Inter, system-ui, sans-serif' },
    tooltip: {
      backgroundColor: t.tooltipBg,
      borderColor: t.grid,
      textStyle: { color: t.text, fontSize: t.fontSize },
      confine: true,
    },
    // Legends are drawn in HTML under each chart (ChartCard), so they wrap on any screen.
    legend: { show: false },
    animationDuration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
  };
}

/** Plot area padding; extra room on the right keeps the last axis label inside the card. */
export function gridOption(t: ChartTheme) {
  return { left: 4, right: t.compact ? 28 : 24, top: 16, bottom: 8, containLabel: true };
}

export function axisStyle(t: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: t.grid } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: t.axisFontSize },
    splitLine: { lineStyle: { color: t.grid } },
  };
}

const SHORT_LABEL: Record<string, string> = { 'Personal Development': 'Personal Dev.' };

/** Shorter area names where a chart has little room (owner request). Tables keep the full name. */
export function chartLabel(name: string): string {
  return SHORT_LABEL[name] ?? name;
}
