// /docs/feed.xml — RSS feed of docs page updates. Pulls last-commit dates
// from git via lib/docs-meta. Refreshed on every build.

import { DOCS_NAV, DOCS_REFERENCE } from '../../../lib/docs-nav';
import { pageMeta } from '../../../lib/docs-meta';

const BASE_URL = 'https://toldproof.xyz';

export function GET() {
  const items = [...DOCS_NAV, ...DOCS_REFERENCE];
  const entries = items
    .map((nav) => {
      const meta = pageMeta(nav.slug);
      const link = `${BASE_URL}/docs/${nav.slug}`;
      // RFC-822 pubDate from ISO date.
      const pubDate = new Date(meta.date + 'T12:00:00Z').toUTCString();
      return `    <item>
      <title>${escapeXml(nav.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(nav.blurb)}</description>
    </item>`;
    })
    .join('\n');

  const latestMeta = pageMeta(items[0]!.slug);
  const lastBuildDate = new Date(latestMeta.date + 'T12:00:00Z').toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>TOLDPROOF docs</title>
    <link>${BASE_URL}/docs</link>
    <description>How TOLDPROOF works — architecture, Move contract, MCP integration, AI judge, audit, skill score.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
