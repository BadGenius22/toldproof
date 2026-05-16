import { useMemo } from 'react';
import { parseBitmap } from './bitmaps';

// `tone` lets callers say *which surface the mark sits on* instead of
// pinning a literal colour. Dark surfaces (brand-mark, receipt-header,
// active step) should pass `tone="on-ink"` so the fill flips with the
// theme without per-surface `.dark` overrides.
type Tone = 'auto' | 'on-paper' | 'on-ink';

interface PixelMarkProps {
  bitmap: string;
  size?: number;
  color?: string;
  tone?: Tone;
  bg?: string;
  radius?: number;
  gap?: number;
  title?: string;
  className?: string;
}

// Pixel bitmap rendered as SVG <rect>s. Crisp at any scale; no raster step.
export function PixelMark({
  bitmap,
  size = 24,
  color,
  tone = 'auto',
  bg = 'transparent',
  radius = 0,
  gap = 0,
  title,
  className,
}: PixelMarkProps) {
  const fill =
    color ??
    (tone === 'on-ink'
      ? 'var(--paper)'
      : tone === 'on-paper'
        ? 'var(--ink)'
        : 'currentColor');
  const { w, h, cells } = useMemo(() => parseBitmap(bitmap), [bitmap]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={(size / w) * h}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      aria-label={title}
      className={className}
    >
      {bg !== 'transparent' && <rect x={0} y={0} width={w} height={h} fill={bg} rx={radius} />}
      {cells.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x + gap / 2}
          y={y + gap / 2}
          width={1 - gap}
          height={1 - gap}
          fill={fill}
        />
      ))}
    </svg>
  );
}
