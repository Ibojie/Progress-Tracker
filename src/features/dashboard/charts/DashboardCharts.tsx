import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { formatDate } from '@/features/elements/model';
import { BAND_LABEL, STATUS_META, bandColor, weekdayIndex, type Band } from '@/lib/engine';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { cn } from '@/lib/utils';
import {
  BAND_ORDER,
  bandDistribution,
  completedByCategory,
  cumulativeCompletions,
  deadlineCalendar,
  statusMix,
  type HeatCell,
} from '../chartData';
import type { DashboardData } from '../useDashboard';
import { ChartCard } from './ChartCard';
import { echarts } from './echarts';
import { axisStyle, baseOption, chartLabel, gridOption, useChartTheme, type ChartTheme } from './chartTheme';

const short = (d: string) => formatDate(d).replace(/ \d{4}$/, '');

/** One small gauge; its own chart so the grid can wrap on narrow screens. */
function GaugeTile({ value, color, t }: { value: number; color: string; t: ChartTheme }) {
  const option = {
    ...baseOption(t),
    legend: undefined,
    series: [
      {
        type: 'gauge',
        center: ['50%', '58%'],
        radius: '92%',
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: 100,
        progress: { show: true, width: 10, roundCap: true, itemStyle: { color } },
        axisLine: { lineStyle: { width: 10, color: [[1, t.grid]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        title: { show: false },
        detail: { offsetCenter: [0, '5%'], formatter: '{value}%', color: t.text, fontSize: t.fontSize + 4, fontWeight: 700 },
        data: [{ value }],
      },
    ],
  };
  return <ReactEChartsCore echarts={echarts} option={option} notMerge style={{ height: 120, width: '100%' }} opts={{ renderer: 'svg' }} />;
}

/** Chart 1: how complete is each area of life? One gauge per category plus overall. */
function Gauges({ data, t }: { data: DashboardData; t: ChartTheme }) {
  const overall = data.kpis.find((k) => k.key === 'completion')?.value ?? 0;
  const items = [
    ...data.categories.map((c, i) => ({ label: chartLabel(c.name), full: c.name, value: c.pct, color: t.categories[i % 4]!, to: `/categories/${c.key}` })),
    { label: 'Overall', full: 'Overall', value: overall, color: t.text, to: null as string | null },
  ];
  return (
    <ChartCard
      title="Completion by area"
      question="How complete is each area of my life?"
      table={{ columns: ['Area', '% complete'], rows: items.map((it) => [it.full, `${it.value}%`]) }}
    >
      {/* 2 per row on phones, 3 on tablets, all 5 in a row on wide screens */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => {
          const body = (
            <>
              <div aria-hidden className="min-w-0 overflow-hidden">
                <GaugeTile value={it.value} color={it.color} t={t} />
              </div>
              <p className="text-center text-label font-semibold">{it.label}</p>
            </>
          );
          return (
            <li key={it.full} className="min-w-0">
              {it.to ? (
                <Link
                  to={it.to}
                  className="block rounded-md p-1 text-foreground no-underline hover:bg-muted"
                  aria-label={`${it.full}: ${it.value}% complete`}
                >
                  {body}
                </Link>
              ) : (
                <div className="p-1" role="img" aria-label={`Overall: ${it.value}% complete`}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

/** Chart 2: am I doing more or less than before? */
function CompletedBars({ data, t }: { data: DashboardData; t: ChartTheme }) {
  const navigate = useNavigate();
  const rows = completedByCategory(data.adviceElements, data.categories, data.period);
  // Phones: horizontal bars so the area names have room (readable-content standard).
  const categoryAxis = { type: 'category', data: rows.map((r) => chartLabel(r.name)), inverse: t.compact, ...axisStyle(t), splitLine: { show: false } };
  const valueAxis = { type: 'value', minInterval: 1, ...axisStyle(t) };
  const radius = t.compact ? [0, 4, 4, 0] : [4, 4, 0, 0];
  const option = {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: gridOption(t),
    xAxis: t.compact ? valueAxis : categoryAxis,
    yAxis: t.compact ? categoryAxis : valueAxis,
    series: [
      { name: data.label.current, type: 'bar', data: rows.map((r) => r.current), itemStyle: { color: t.current, borderRadius: radius }, barGap: '10%' },
      { name: `Same point ${data.label.previous}`, type: 'bar', data: rows.map((r) => r.previous), itemStyle: { color: t.previous, borderRadius: radius } },
    ],
  };
  return (
    <ChartCard
      title="Goals completed by area"
      question="Am I doing more or less than before?"
      option={option}
      height={t.compact ? 40 + rows.length * 56 : 260}
      legend={[
        { label: data.label.current, color: t.current },
        { label: `Same point ${data.label.previous}`, color: t.previous },
      ]}
      onClick={(p) => {
        const row = rows.find((r) => chartLabel(r.name) === p.name);
        if (row) navigate(`/categories/${row.key}`);
      }}
      table={{ columns: ['Area', data.label.current, `Same point ${data.label.previous}`], rows: rows.map((r) => [r.name, r.current, r.previous]) }}
    />
  );
}

/** Chart 3: is my momentum improving? */
function Momentum({ data, t }: { data: DashboardData; t: ChartTheme }) {
  const c = cumulativeCompletions(data.doneDates, data.period);
  const option = {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'axis' },
    grid: gridOption(t),
    xAxis: { type: 'category', data: c.days.map((_, i) => `Day ${i + 1}`), boundaryGap: false, ...axisStyle(t), splitLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, ...axisStyle(t) },
    series: [
      { name: data.label.current, type: 'line', data: c.current, showSymbol: c.current.length < 15, symbolSize: 8, lineStyle: { width: 2, color: t.current }, itemStyle: { color: t.current } },
      {
        name: data.label.previous.replace(/^./, (s) => s.toUpperCase()),
        type: 'line',
        data: c.previous,
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed', color: t.previous },
        itemStyle: { color: t.previous },
      },
    ],
  };
  return (
    <ChartCard
      title="Momentum"
      question="Running total of goals completed: is my momentum improving?"
      option={option}
      height={260}
      legend={[
        { label: data.label.current, color: t.current },
        { label: `Same days ${data.label.previous}`, color: t.previous, dashed: true },
      ]}
      table={{
        columns: ['Day', data.label.current, data.label.previous],
        rows: c.days.map((_, i) => [`Day ${i + 1}`, c.current[i] ?? '–', c.previous[i] ?? '–']),
      }}
    />
  );
}

/** Chart 4: where are things stuck, delayed or abandoned? */
function StatusMixChart({ data, t }: { data: DashboardData; t: ChartTheme }) {
  const navigate = useNavigate();
  const mix = statusMix(data.adviceElements, data.categories);
  const option = {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: gridOption(t),
    xAxis: { type: 'value', minInterval: 1, ...axisStyle(t) },
    yAxis: { type: 'category', data: mix.rows.map((r) => chartLabel(r.name)), inverse: true, ...axisStyle(t), splitLine: { show: false } },
    series: mix.statuses.map((s) => ({
      name: STATUS_META[s].label,
      type: 'bar',
      stack: 'mix',
      data: mix.rows.map((r) => r.counts[mix.statuses.indexOf(s)] || null),
      itemStyle: { color: STATUS_META[s].bg, borderColor: t.surface, borderWidth: 2 },
      barWidth: 22,
    })),
  };
  return (
    <ChartCard
      title="Status mix by area"
      question="Where are things stuck, delayed or abandoned?"
      option={option}
      height={40 + mix.rows.length * (t.compact ? 52 : 48)}
      legend={mix.statuses.map((s) => ({ label: STATUS_META[s].label, color: STATUS_META[s].bg }))}
      empty={mix.statuses.length === 0 ? 'Add elements to see their statuses here.' : null}
      onClick={(p) => {
        const row = mix.rows.find((r) => chartLabel(r.name) === p.name);
        const status = mix.statuses.find((s) => STATUS_META[s].label === p.seriesName);
        if (row) navigate(`/categories/${row.key}${status ? `?status=${status}` : ''}`);
      }}
      table={{ columns: ['Area', ...mix.statuses.map((s) => STATUS_META[s].label)], rows: mix.rows.map((r) => [r.name, ...r.counts]) }}
    />
  );
}

/** Chart 6: am I neglecting an area of my life? */
function Balance({ data, t }: { data: DashboardData; t: ChartTheme }) {
  // Draw the previous shape only when every area has history; a missing value isn't 0%.
  const hasPrevious = data.categories.length > 0 && data.categories.every((c) => c.previousPct !== null);
  const option = {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'item' },
    radar: {
      indicator: data.categories.map((c) => ({ name: chartLabel(c.name), max: 100 })),
      // Phones: a smaller radar and names wrapped onto two lines, so side labels stay inside the card.
      radius: t.compact ? '34%' : '66%',
      center: ['50%', '52%'],
      axisName: {
        color: t.text,
        fontSize: t.axisFontSize,
        formatter: (name: string) => (t.compact ? name.split(' ').join('\n') : name),
      },
      splitLine: { lineStyle: { color: t.grid } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: t.grid } },
    },
    series: [
      {
        type: 'radar',
        data: [
          { name: data.label.current, value: data.categories.map((c) => c.pct), lineStyle: { width: 2, color: t.current }, itemStyle: { color: t.current }, areaStyle: { color: t.current, opacity: 0.15 } },
          ...(hasPrevious
            ? [
                {
                  name: `Same point ${data.label.previous}`,
                  value: data.categories.map((c) => c.previousPct ?? 0),
                  lineStyle: { width: 2, type: 'dashed', color: t.previous },
                  itemStyle: { color: t.previous },
                },
              ]
            : []),
        ],
      },
    ],
  };
  return (
    <ChartCard
      title="Balance across areas"
      question="Am I neglecting an area of my life?"
      option={option}
      height={t.compact ? 260 : 300}
      legend={[
        { label: data.label.current, color: t.current },
        ...(hasPrevious ? [{ label: `Same point ${data.label.previous}`, color: t.previous, dashed: true }] : []),
      ]}
      table={{
        columns: ['Area', data.label.current, `Same point ${data.label.previous}`],
        rows: data.categories.map((c) => [c.name, `${c.pct}%`, c.previousPct === null ? 'No history yet' : `${c.previousPct}%`]),
      }}
    />
  );
}

/** Chart 7: how much is urgent right now? */
function BandDonut({ data, t }: { data: DashboardData; t: ChartTheme }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dist = bandDistribution(data.adviceElements, data.today);
  const total = dist.reduce((n, d) => n + d.count, 0);
  const sample: Record<Band, number> = { overdue: -1, immediate: 7, short: 22, medium: 45, long: 80 };
  const option = {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['50%', '50%'],
        itemStyle: { borderColor: t.surface, borderWidth: 2 },
        label: { show: false },
        data: dist
          .filter((d) => d.count > 0)
          .map((d) => ({ name: BAND_LABEL[d.band], value: d.count, itemStyle: { color: bandColor(sample[d.band], theme).bg } })),
      },
    ],
  };
  return (
    <ChartCard
      title="Open goals by urgency"
      question="How much is urgent right now?"
      option={option}
      height={t.compact ? 220 : 260}
      legend={dist.filter((d) => d.count > 0).map((d) => ({ label: `${BAND_LABEL[d.band]} (${d.count})`, color: bandColor(sample[d.band], theme).bg }))}
      empty={total === 0 ? 'No open goals.' : null}
      onClick={(p) => {
        const band = BAND_ORDER.find((b) => BAND_LABEL[b] === p.name);
        if (band) navigate(`/timeline?band=${band}`);
      }}
      table={{ columns: ['Band', 'Open goals'], rows: dist.map((d) => [BAND_LABEL[d.band], d.count]) }}
    />
  );
}

/** Chart 5: when are my crunch periods? A 90-day calendar, cells coloured by band. */
function DeadlineCalendar({ data }: { data: DashboardData }) {
  const { theme } = useTheme();
  const cells = useMemo(() => deadlineCalendar(data.adviceElements, data.today), [data.adviceElements, data.today]);
  const [selected, setSelected] = useState<HeatCell | null>(null);

  // Columns are Monday-first weeks; pad the first week so today sits on its weekday.
  const padded: (HeatCell | null)[] = [...Array<null>(weekdayIndex(data.today)).fill(null), ...cells];
  const weeks: (HeatCell | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  const monthLabel = (week: (HeatCell | null)[]) => {
    const first = week.find((c) => c && (c.date.endsWith('-01') || c === cells[0]));
    return first ? short(first.date).split(' ')[1] : '';
  };

  return (
    <ChartCard
      title="Deadline calendar, next 90 days"
      question="When are my crunch periods? Colour shows how close the date is; the number is goals due."
      table={{ columns: ['Date', 'Goals due'], rows: cells.filter((c) => c.count > 0).map((c) => [formatDate(c.date), c.count]) }}
    >
      <div className="overflow-x-auto pb-1">
        <div className="grid w-max gap-1" style={{ gridTemplateColumns: `auto repeat(${weeks.length}, 2.5rem)` }}>
          <span aria-hidden />
          {weeks.map((week, w) => (
            <span key={w} className="text-label text-muted-foreground" aria-hidden>
              {monthLabel(week)}
            </span>
          ))}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, d) => (
            <div key={day} className="contents">
              <span className="flex items-center pr-1 text-label text-muted-foreground" aria-hidden>
                {day}
              </span>
              {weeks.map((week, w) => {
                const cell = week[d] ?? null;
                if (!cell) return <span key={w} aria-hidden />;
                const daysLeft = cells.indexOf(cell);
                const { bg, fg } = cell.count > 0 ? bandColor(daysLeft, theme) : { bg: 'transparent', fg: 'inherit' };
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSelected(cell.count > 0 ? cell : null)}
                    aria-label={`${formatDate(cell.date)}: ${cell.count} ${cell.count === 1 ? 'goal' : 'goals'} due`}
                    aria-pressed={selected?.date === cell.date}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-[4px] border text-label font-bold tabular-nums',
                      cell.count > 0 ? 'border-transparent' : 'border-border/40',
                      selected?.date === cell.date && 'outline outline-2 outline-offset-1 outline-ring',
                    )}
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    {cell.count > 0 ? cell.count : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {selected && (
        <div className="rounded-md border border-border/60 bg-surface/70 p-3" aria-live="polite">
          <p className="font-semibold">Due {formatDate(selected.date)}</p>
          <ul className="mt-1 grid gap-1 text-secondary">
            {selected.goals.map((g) => (
              <li key={g.goalId}>
                <Link to={`/elements/${g.elementId}`} className="text-foreground">
                  {g.title}
                </Link>{' '}
                <span className="text-muted-foreground">({g.elementName})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

/** All dashboard charts (§8). Loaded separately so the first screen appears quickly. */
export default function DashboardCharts({ data }: { data: DashboardData }) {
  const t = useChartTheme();
  return (
    <section aria-labelledby="charts-heading" className="mb-8">
      <h2 id="charts-heading" className="mb-4 text-h2 font-semibold">
        Charts
      </h2>
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="lg:col-span-2">
          <Gauges data={data} t={t} />
        </div>
        <CompletedBars data={data} t={t} />
        <Momentum data={data} t={t} />
        <StatusMixChart data={data} t={t} />
        <BandDonut data={data} t={t} />
        <div className="lg:col-span-2">
          <DeadlineCalendar data={data} />
        </div>
        <Balance data={data} t={t} />
      </div>
    </section>
  );
}
