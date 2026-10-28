import { Fragment, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/features/auth/AuthProvider';
import { APP_NAME, DOCUMENTS, EFFECTIVE_DATE, OPERATOR, type Block, type LegalDocument } from '@/features/legal/documents';

/** [text](url) links inside the documents: in-app paths use the router, others are plain links. */
function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, label, href] = m;
    parts.push(
      href!.startsWith('/') ? (
        <Link key={m.index} to={href!}>
          {label}
        </Link>
      ) : (
        <a key={m.index} href={href}>
          {label}
        </a>
      ),
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function BlockView({ block }: { block: Block }) {
  if (typeof block === 'string') return <p className="mb-3">{<Rich text={block} />}</p>;
  if ('list' in block) {
    return (
      <ul className="mb-3 list-disc space-y-1.5 pl-6">
        {block.list.map((item, i) => (
          <li key={i}>
            <Rich text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    // Scrolls sideways on narrow phones; focusable so it can be scrolled with the keyboard too.
    <div className="mb-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Service providers (scrolls sideways)">
      <table className="w-full min-w-[32rem] border-collapse text-left text-secondary">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-3 font-semibold">Provider</th>
            <th scope="col" className="py-2 pr-3 font-semibold">What it does</th>
            <th scope="col" className="py-2 font-semibold">Where</th>
          </tr>
        </thead>
        <tbody>
          {block.table.map(([who, what, where]) => (
            <tr key={who} className="border-b border-border/60 align-top">
              <th scope="row" className="py-2 pr-3 font-semibold">
                {who}
              </th>
              <td className="py-2 pr-3">{what}</td>
              <td className="py-2">{where}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A public legal page (no sign-in needed: Google Play links to these). Readable measure, a
 * contents list with anchor links, and links to the other documents.
 */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const { session } = useAuth();

  useEffect(() => {
    document.title = `${doc.title} · ${APP_NAME}`;
    // Follow #section links on first load (e.g. /privacy#retention).
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
    return () => {
      document.title = APP_NAME;
    };
  }, [doc]);

  return (
    <div className="min-h-dvh">
      <header className="glass flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-2">
        <Link to={session ? '/settings' : '/login'} className="inline-flex min-h-tap items-center gap-2 font-semibold no-underline">
          <ArrowLeft aria-hidden className="size-5" />
          <BrandMark className="size-8" />
          {APP_NAME}
        </Link>
        <ThemeToggle />
      </header>

      <main id="main" className="mx-auto max-w-[70ch] px-4 py-8 text-body leading-relaxed">
        <h1 className="text-h1 font-bold leading-tight">{doc.title}</h1>
        <p className="mt-2 text-muted-foreground">{doc.summary}</p>
        <p className="mt-1 text-label text-muted-foreground">
          {OPERATOR} · Effective {EFFECTIVE_DATE}
        </p>

        <nav aria-label="On this page" className="glass mt-6 rounded-lg p-4">
          <h2 className="mb-2 font-semibold">On this page</h2>
          <ol className="list-decimal space-y-1 pl-6">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.heading}</a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-8 scroll-mt-4">
            <h2 id={`${s.id}-h`} className="mb-3 text-h3 font-semibold">
              {s.heading}
            </h2>
            {s.body.map((b, i) => (
              <Fragment key={i}>
                <BlockView block={b} />
              </Fragment>
            ))}
          </section>
        ))}

        <nav aria-label="Legal documents" className="mt-12 border-t border-border pt-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {DOCUMENTS.filter((d) => d.slug !== doc.slug).map((d) => (
              <li key={d.slug}>
                <Link to={`/${d.slug}`} className="inline-flex min-h-tap items-center">
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
