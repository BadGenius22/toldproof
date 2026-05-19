// Build-time helpers for docs page metadata: last commit, reading time, slug.
// Used by MetaStrip + the redesigned index page.
// Runs at build time only (uses child_process — not safe in client bundles).

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export interface CommitInfo {
  sha: string; // 7-char short SHA
  date: string; // YYYY-MM-DD ISO date
}

/**
 * Returns the last commit that touched a /docs page. Falls back to ("local",
 * today) on Vercel preview deploys where git history may not be available.
 */
export function getLastCommit(slug: string): CommitInfo {
  const target = `app/docs/${slug}/page.tsx`;
  try {
    const out = execSync(
      `git log -1 --format=%h:%cs -- ${target}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (!out) throw new Error('empty git output');
    const [sha, date] = out.split(':');
    if (!sha || !date) throw new Error('malformed git output');
    return { sha, date };
  } catch {
    return { sha: 'local', date: todayIso() };
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Quick reading-time estimate. 240 wpm reading speed (slightly above silent
 * reading because docs are technical and readers skim more).
 */
export function computeReadingTime(plain: string): number {
  const words = plain.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 240));
}

/**
 * Reading time for a docs slug — pulls text content from the page.tsx file.
 * This is rough (it scans the literal JSX source for prose-shaped strings)
 * but consistent across builds.
 */
export function readingTimeFor(slug: string): number {
  const file = path.join(process.cwd(), 'app', 'docs', slug, 'page.tsx');
  if (!existsSync(file)) return 3;
  try {
    const src = readFileSync(file, 'utf8');
    // Extract string literals + JSX text. Cheap heuristic — counts characters
    // inside double-quoted strings and between JSX angle brackets.
    const strings = src.match(/"[^"\\]*(\\.[^"\\]*)*"/g) || [];
    const jsxText = src.replace(/<[^>]+>/g, ' ').replace(/[{}]/g, ' ');
    const combined = strings.join(' ') + ' ' + jsxText;
    return computeReadingTime(combined);
  } catch {
    return 3;
  }
}

/**
 * Kebab-case slug from a heading string. Used by auto-anchor logic on H2/H3.
 * Mirrors GitHub's slugifier closely enough for hash-link compatibility.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\-·–—]/g, '')
    .replace(/[\s_·–—]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface PageMeta extends CommitInfo {
  slug: string;
  readingMin: number;
}

export function pageMeta(slug: string): PageMeta {
  const commit = getLastCommit(slug);
  return {
    slug,
    sha: commit.sha,
    date: commit.date,
    readingMin: readingTimeFor(slug),
  };
}
