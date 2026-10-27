import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Gauge, Hourglass, Lightbulb, PartyPopper, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Advice, FocusItem, Stall } from '@/lib/engine';

const STALL_TEXT: Record<Stall['kind'], (days: number) => string> = {
  no_ticks: (d) => `no goal ticked for ${d} days`,
  resource_delay: (d) => `waiting on resources for ${d} days`,
  started_idle: (d) => `started ${d} days ago with nothing ticked yet`,
};

function when(item: FocusItem): string {
  if (item.daysLeft < 0) return `overdue by ${-item.daysLeft} ${item.daysLeft === -1 ? 'day' : 'days'}`;
  if (item.daysLeft === 0) return 'due today';
  return `due in ${item.daysLeft} ${item.daysLeft === 1 ? 'day' : 'days'}`;
}

function Block({ icon: Icon, title, children }: { icon: typeof Eye; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 font-semibold">
        <Icon aria-hidden className="size-5 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}

/** Rule-based commentary and advice (§7.1). No AI, so it is always available. */
export function AdviceCard({ advice }: { advice: Advice }) {
  const next = advice.focus.slice(0, 5);
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb aria-hidden className="size-6 text-primary" /> Progress and advice
        </CardTitle>
        <p className="text-body">{advice.overall}</p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Block icon={Target} title="Focus on (next 29 days)">
          {next.length === 0 ? (
            <p className="text-secondary text-muted-foreground">Nothing due in the next 29 days.</p>
          ) : (
            <ol className="grid list-decimal gap-1 pl-6 text-secondary">
              {next.map((f) => (
                <li key={f.goalId}>
                  <Link to={`/elements/${f.elementId}`} className="text-foreground">
                    {f.goalTitle}
                  </Link>{' '}
                  <span className="text-muted-foreground">
                    ({f.elementName}, {when(f)}
                    {f.behindPace ? ', behind pace' : ''})
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Block>

        <Block icon={Gauge} title="Behind pace">
          {advice.behindPace.length === 0 ? (
            <p className="text-secondary text-muted-foreground">Everything is on pace.</p>
          ) : (
            <ul className="grid gap-1 text-secondary">
              {advice.behindPace.map((p) => (
                <li key={p.elementId}>
                  <Link to={`/elements/${p.elementId}`} className="text-foreground">
                    {p.elementName}
                  </Link>
                  : {p.actualPct}% done, about {p.expectedPct}% expected by now
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block icon={Eye} title="Keep tabs on (30+ days away)">
          {advice.keepTabsOn.length === 0 ? (
            <p className="text-secondary text-muted-foreground">No longer-term elements are falling behind.</p>
          ) : (
            <ul className="grid gap-1 text-secondary">
              {advice.keepTabsOn.map((p) => (
                <li key={p.elementId}>
                  <Link to={`/elements/${p.elementId}`} className="text-foreground">
                    {p.elementName}
                  </Link>{' '}
                  is behind pace ({p.actualPct}% vs about {p.expectedPct}%)
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block icon={Hourglass} title="Stalled">
          {advice.stalls.length === 0 ? (
            <p className="text-secondary text-muted-foreground">Nothing has stalled.</p>
          ) : (
            <ul className="grid gap-1 text-secondary">
              {advice.stalls.map((s) => (
                <li key={`${s.elementId}-${s.kind}`}>
                  <Link to={`/elements/${s.elementId}`} className="text-foreground">
                    {s.elementName}
                  </Link>
                  : {STALL_TEXT[s.kind](s.days)}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block icon={PartyPopper} title="Wins">
          {advice.wins.completed.length === 0 && !advice.wins.mostImproved ? (
            <p className="text-secondary text-muted-foreground">Complete an element or lift a category to see wins here.</p>
          ) : (
            <ul className="grid gap-1 text-secondary">
              {advice.wins.completed.map((w) => (
                <li key={w.elementId}>
                  Completed{' '}
                  <Link to={`/elements/${w.elementId}`} className="text-foreground">
                    {w.elementName}
                  </Link>
                </li>
              ))}
              {advice.wins.mostImproved && (
                <li>
                  Most improved: {advice.wins.mostImproved.name} (▲{advice.wins.mostImproved.points} pts)
                </li>
              )}
            </ul>
          )}
        </Block>
      </CardContent>
    </Card>
  );
}
