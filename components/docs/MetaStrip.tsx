// MetaStrip — top-of-page strip: UPDATED · COMMIT · READ · SECTION.
// Receipt-style monospace tokens, separated by · dots. Server component.

import type { PageMeta } from '../../lib/docs-meta';

interface Props {
  meta: PageMeta;
  ix: string;
  total: number;
}

export function MetaStrip({ meta, ix, total }: Props) {
  return (
    <div
      className="mono docs-meta-strip"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px 18px',
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        padding: '12px 0',
        borderTop: '1px dashed var(--border)',
        borderBottom: '1px dashed var(--border)',
        marginBottom: 24,
      }}
    >
      <Token label="Updated" value={meta.date} />
      <Token label="Commit" value={`0x${meta.sha}`} mono />
      <Token label="Read" value={`${meta.readingMin} min`} />
      <Token label="Section" value={`${ix} of ${String(total).padStart(2, '0')}`} />
    </div>
  );
}

function Token({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
      <span>{label}</span>
      <span
        style={{
          color: 'var(--ink-2)',
          fontWeight: mono ? 600 : 500,
          letterSpacing: mono ? '0.04em' : '0.08em',
        }}
      >
        {value}
      </span>
    </span>
  );
}
