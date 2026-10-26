import { formatDate, type ElementView } from '@/features/elements/model';
import { useTimezone, useToday } from '@/features/profile/useProfile';
import { dateIn } from '@/lib/engine';
import { burndown } from '../chartData';
import { ChartCard } from './ChartCard';
import { axisStyle, baseOption, useChartTheme } from './chartTheme';

/** Chart 8: will I finish this on time? Goals still open each day vs a straight-line ideal. */
export default function ElementBurndown({ view }: { view: ElementView }) {
  const t = useChartTheme();
  const today = useToday();
  const tz = useTimezone();
  const data = burndown(
    view.goals.map((g) => ({
      startDate: g.row.start_date,
      dueDate: g.row.due_date,
      doneDate: g.row.done_at ? dateIn(g.row.done_at, tz) : null,
    })),
    today,
  );
  if (!data) return null;

  const labels = data.days.map((d) => formatDate(d).replace(/ \d{4}$/, ''));
  const todayIndex = data.days.indexOf(today);
  const option = {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'axis' },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: labels, boundaryGap: false, ...axisStyle(t), splitLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, max: view.total, name: 'Open goals', nameTextStyle: { color: t.muted, fontSize: t.axisFontSize }, ...axisStyle(t) },
    series: [
      {
        name: 'Open goals',
        type: 'line',
        step: 'end',
        data: data.actual,
        showSymbol: false,
        lineStyle: { width: 2, color: t.current },
        itemStyle: { color: t.current },
        markLine:
          todayIndex >= 0
            ? {
                symbol: 'none',
                label: { formatter: 'Today', color: t.text, fontSize: t.axisFontSize },
                lineStyle: { color: t.muted, type: 'solid', width: 1 },
                data: [{ xAxis: todayIndex }],
              }
            : undefined,
      },
      { name: 'Ideal', type: 'line', data: data.ideal, showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: t.ideal }, itemStyle: { color: t.ideal } },
    ],
  };

  return (
    <ChartCard
      title="Burndown"
      question="Will I finish this on time? If the solid line stays above the dashed one, you're behind."
      option={option}
      height={260}
      table={{
        columns: ['Date', 'Open goals', 'Ideal'],
        rows: data.days.map((d, i) => [formatDate(d), data.actual[i] ?? '–', data.ideal[i]!]),
      }}
    />
  );
}
