import { useId, useState, type ReactNode } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { echarts } from './echarts';

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

interface ChartCardProps {
  title: string;
  /** One line saying what the chart shows (§8). */
  question: string;
  table: TableData;
  /** ECharts option; omit to render `children` instead (for HTML charts). */
  option?: object;
  height?: number;
  onClick?: (params: { name?: string; seriesName?: string; dataIndex?: number }) => void;
  children?: ReactNode;
  empty?: string | null;
}

/** Card with title, one-line explanation, the chart, and a table view for screen readers (§10). */
export function ChartCard({ title, question, table, option, height = 280, onClick, children, empty }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  const switchId = useId();

  return (
    <figure className="glass flex flex-col gap-3 rounded-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <figcaption>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-label text-muted-foreground">{question}</p>
        </figcaption>
        <div className="flex items-center gap-2">
          <Switch id={switchId} checked={asTable} onCheckedChange={setAsTable} />
          <Label htmlFor={switchId} className="text-label">
            Table
          </Label>
        </div>
      </div>

      {empty ? (
        <p className="py-8 text-center text-secondary text-muted-foreground">{empty}</p>
      ) : asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="border-b border-border/60 px-2 py-2 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className="border-b border-border/30 px-2 py-2 tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : option ? (
        // Screen readers get a label here; the Table switch gives them the values (§10).
        <div role="img" aria-label={`${title}. ${question} Switch on Table to read the values.`}>
          <ReactEChartsCore
            echarts={echarts}
            option={option}
            notMerge
            style={{ height, width: '100%' }}
            opts={{ renderer: 'svg' }}
            onEvents={onClick ? { click: onClick } : undefined}
          />
        </div>
      ) : (
        children
      )}
    </figure>
  );
}
