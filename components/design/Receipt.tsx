import type { CSSProperties, ReactNode } from 'react';

interface ReceiptRowProps {
  k: ReactNode;
  v: ReactNode;
  mono?: boolean;
}

export function ReceiptRow({ k, v, mono = true }: ReceiptRowProps) {
  const ddStyle: CSSProperties = mono ? {} : { fontFamily: 'var(--font-sans)' };
  return (
    <div className="receipt-row">
      <dt>{k}</dt>
      <dd style={ddStyle}>{v}</dd>
    </div>
  );
}

export function Perforation() {
  return <hr className="perf" />;
}

interface HexDumpProps {
  hex: string;
  rows?: number;
  highlightFirst?: number;
}

// Renders a hex string in 16-byte rows with an offset gutter, highlighting the
// first N bytes as "plain" (rest is "cipher"). Used by seal + reveal + verify.
export function HexDump({ hex, rows = 4, highlightFirst = 0 }: HexDumpProps) {
  const out: ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    const offset = (r * 16).toString(16).padStart(4, '0');
    const rowBytes = hex.slice(r * 32, r * 32 + 32);
    const groups: ReactNode[] = [];
    for (let i = 0; i < rowBytes.length; i += 2) {
      const byteIdx = r * 16 + i / 2;
      const isPlain = byteIdx < highlightFirst;
      const b = rowBytes.slice(i, i + 2);
      groups.push(
        <span key={i} className={isPlain ? 'plain' : 'cipher'}>
          {b}
          {i < 30 ? ' ' : ''}
        </span>,
      );
    }
    out.push(
      <div key={r}>
        <span style={{ color: 'var(--muted)' }}>{offset}&nbsp;&nbsp;</span>
        {groups}
      </div>,
    );
  }
  return <div className="hex">{out}</div>;
}

export function PageEyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}
