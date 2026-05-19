// Shared OG renderer for /docs/*. Each route's opengraph-image.tsx imports
// renderDocsOg(slug) — receipt-style card, ink type on warm paper, with
// the section eyebrow + page title + a stamped "DOCS · TOLDPROOF" footer.
//
// Satori (next/og) constraints:
// - Every <div> with children must have explicit display: flex / contents.
// - z-index is not supported (use document order to stack).

import { ImageResponse } from 'next/og';
import { findNavItem } from './docs-nav';

export const size = { width: 1200, height: 630 } as const;
export const contentType = 'image/png' as const;

const EYEBROW_BY_SLUG: Record<string, string> = {
  architecture: 'How it works',
  'move-contract': 'On Sui',
  mcp: 'For AI agents',
  resolution: 'The AI judge',
  audit: 'Security',
  'skill-score': 'Reference · methodology',
};

export function renderDocsOg(slug: string) {
  const nav = findNavItem(slug);
  const title = nav?.title ?? 'Docs · TOLDPROOF';
  const eyebrow = EYEBROW_BY_SLUG[slug] ?? 'Docs';
  const badge = nav?.badge ?? '';
  const stat = nav?.stat ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#f6f4ef',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 72px',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* outer receipt frame (rendered after content so it's on top in
            document order — Satori has no z-index). Empty div ok. */}

        {/* eyebrow */}
        <div
          style={{
            display: 'flex',
            fontSize: 20,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#807c70',
            marginBottom: 28,
          }}
        >
          TOLDPROOF · DOCS · {eyebrow.toUpperCase()}
        </div>

        {/* title */}
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            color: '#14130f',
            fontWeight: 700,
            letterSpacing: -1,
            lineHeight: 1.05,
            maxWidth: 960,
          }}
        >
          {title}
        </div>

        {/* spacer */}
        <div style={{ display: 'flex', flex: 1 }} />

        {/* footer row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            color: '#44413a',
            fontSize: 22,
            letterSpacing: 1.5,
          }}
        >
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
            <span style={{ color: '#14130f', fontWeight: 700 }}>
              toldproof.xyz/docs/{slug}
            </span>
            {badge ? (
              <span
                style={{
                  fontSize: 16,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: '#807c70',
                }}
              >
                · {badge}
              </span>
            ) : null}
          </div>
          {stat ? (
            <div
              style={{
                display: 'flex',
                fontSize: 16,
                letterSpacing: 2,
                color: '#807c70',
                textTransform: 'uppercase',
              }}
            >
              {stat}
            </div>
          ) : null}
        </div>

        {/* stamp accent */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            right: 96,
            top: 96,
            width: 140,
            height: 140,
            border: '4px solid #14130f',
            background: '#f6f4ef',
            transform: 'rotate(8deg)',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#14130f',
            fontWeight: 700,
            letterSpacing: 2,
            fontSize: 16,
            textTransform: 'uppercase',
            boxShadow: '6px 6px 0 #d6b97a',
          }}
        >
          {nav?.ix ?? 'docs'}
        </div>

        {/* outer receipt frame — empty, on top of everything via doc order */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 32,
            right: 32,
            top: 32,
            bottom: 32,
            border: '4px solid #14130f',
            borderRadius: 6,
            pointerEvents: 'none',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
