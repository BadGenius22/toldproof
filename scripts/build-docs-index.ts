// Build-time search index for /docs.
// Walks app/docs/* page.tsx files, extracts H2 slug + title pairs and
// surrounding prose snippets, emits public/docs/search-index.json that the
// DocsSearch client component fetches at runtime.
//
// Usage: pnpm tsx scripts/build-docs-index.ts (wired as prebuild hook).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, 'app', 'docs');
const OUT_PATH = join(ROOT, 'public', 'docs', 'search-index.json');

interface IndexEntry {
  path: string;
  title: string;
  section: string;
  anchor: string;
  snippet: string;
}

// Match lib/docs-nav.ts ordering — only these slugs get indexed.
// Each entry is `[slug, page-title-fallback]`.
const SLUGS: Array<[string, string]> = [
  ['architecture', 'Architecture'],
  ['move-contract', 'Move contract'],
  ['mcp', 'MCP integration'],
  ['resolution', 'Resolution Agent'],
  ['audit', 'Audit'],
  ['skill-score', 'Skill score math'],
];

function extractH2s(src: string): Array<{ slug: string; title: string; offset: number }> {
  // Matches <H2 slug="...">label</H2>
  const re = /<H2\s+slug=["']([^"']+)["']\s*>([\s\S]*?)<\/H2>/g;
  const out: Array<{ slug: string; title: string; offset: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const slug = m[1]!;
    const title = m[2]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    out.push({ slug, title, offset: m.index });
  }
  return out;
}

function extractSnippet(src: string, fromOffset: number, maxLen = 200): string {
  // Take the next ~600 chars after the H2 close, strip JSX, normalize.
  const slice = src.slice(fromOffset, fromOffset + 1200);
  const noJsx = slice
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/\{[^{}]*?\}/g, ' ')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return noJsx.slice(0, maxLen);
}

function extractPageTitle(src: string, fallback: string): string {
  const m = src.match(/title:\s*["'`]([^"'`]+)["'`]/);
  if (m) {
    // Trim trailing " · TOLDPROOF docs" if present.
    return m[1]!.replace(/\s*·\s*TOLDPROOF.*$/, '').trim();
  }
  return fallback;
}

function buildIndex(): IndexEntry[] {
  const out: IndexEntry[] = [];
  for (const [slug, fallback] of SLUGS) {
    const file = join(DOCS_DIR, slug, 'page.tsx');
    if (!existsSync(file)) continue;
    const src = readFileSync(file, 'utf8');
    const pageTitle = extractPageTitle(src, fallback);
    const h2s = extractH2s(src);

    // Page-level entry (first hit so a top-of-page match always works).
    out.push({
      path: `/docs/${slug}`,
      title: pageTitle,
      section: 'Overview',
      anchor: '',
      snippet: extractSnippet(src, 0, 240),
    });

    for (const h of h2s) {
      out.push({
        path: `/docs/${slug}`,
        title: pageTitle,
        section: h.title,
        anchor: `#${h.slug}`,
        snippet: extractSnippet(src, h.offset + 200, 200),
      });
    }
  }
  return out;
}

function main() {
  const index = buildIndex();
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(index), 'utf8');
  console.log(`[build-docs-index] wrote ${index.length} entries → ${OUT_PATH}`);
}

main();
