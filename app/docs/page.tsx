// /docs — developer + judge entrypoint. Numbered cards on a left rail with
// the first-card-featured treatment; audience switcher reorders the cards.
// Content for each card is pulled from lib/docs-nav (single source of truth).

import { PageEyebrow } from '../../components/design';
import { DOCS_NAV, DOCS_REFERENCE } from '../../lib/docs-nav';
import { pageMeta } from '../../lib/docs-meta';
import { DocsIndex } from '../../components/docs/DocsIndex';

export const metadata = {
  title: 'Docs · TOLDPROOF',
  description:
    'How TOLDPROOF works: the Sui Move contract, the time-locked seal flow, the MCP + x402 agent surface, the AI Resolution Agent, and the v3 audit.',
};

export default function DocsIndexPage() {
  const metas: Record<string, { sha: string; date: string; readingMin: number }> = {};
  for (const n of [...DOCS_NAV, ...DOCS_REFERENCE]) {
    const m = pageMeta(n.slug);
    metas[n.slug] = { sha: m.sha, date: m.date, readingMin: m.readingMin };
  }

  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Docs</PageEyebrow>
        <h1
          className="display"
          style={{
            fontSize: 'clamp(34px, 5vw, 56px)',
            marginTop: 12,
            maxWidth: 780,
            textWrap: 'pretty',
          }}
        >
          Everything you need to understand TOLDPROOF in five minutes.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 680,
          }}
        >
          Five short pages, in the order we&apos;d explain it ourselves. Start with
          the picture of how it all fits together, walk down to the on-chain
          receipt, see how AI agents plug in, how the AI judge decides hit or
          miss, and what the security review cleared. Every page links back to the
          live code on GitHub.
        </p>

        <DocsIndex metas={metas} />

        <div
          className="mt-48"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 22,
            background: 'var(--paper-2)',
            display: 'grid',
            gap: 14,
          }}
        >
          <span className="eyebrow">Going deeper</span>
          <div
            className="row"
            style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof"
              label="GitHub repo"
            />
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof/blob/main/spec.md"
              label="Full spec.md"
            />
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V3.md"
              label="v3 audit (markdown)"
            />
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof/blob/main/ROADMAP_V4.md"
              label="v4 roadmap"
            />
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof/blob/main/README.md"
              label="README"
            />
            <ResourceLink href="/docs/feed.xml" label="RSS feed" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceLink({ href, label }: { href: string; label: string }) {
  const external = href.startsWith('http');
  const props = external
    ? { target: '_blank' as const, rel: 'noreferrer' as const }
    : {};
  return (
    <a
      href={href}
      {...props}
      className="mono"
      style={{
        fontSize: 12,
        padding: '6px 10px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        color: 'var(--ink-2)',
        textDecoration: 'none',
        letterSpacing: '0.04em',
        background: 'var(--paper)',
      }}
    >
      {label} {external ? '↗' : '→'}
    </a>
  );
}
