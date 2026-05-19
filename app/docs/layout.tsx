// /docs layout — thin passthrough. Each page wraps its body in <DocsShell>.
//
// The shell needs the slug, which lives on the page itself, so we can't
// install it here without losing the per-page context. The actual chrome
// (sidebar, TOC, meta strip, prev/next footer) lives in DocsShell.

import type { ReactNode } from 'react';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
