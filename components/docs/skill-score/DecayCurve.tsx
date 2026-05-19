// Inline SVG decay curve next to the recency table. Renders 0.5^(t/halfLife)
// across viewBox 480×200 with half-life vertical markers + ½ ¼ ⅛ labels.
// Anchored to the real constant — changing SKILL_HALF_LIFE_MS updates the
// curve shape and the marker positions.

import { SKILL_HALF_LIFE_MS } from '../../../lib/leaderboard';

const HALF_LIFE_DAYS = SKILL_HALF_LIFE_MS / (24 * 60 * 60 * 1000);
const MAX_DAYS = HALF_LIFE_DAYS * 4; // show 4 half-lives

const W = 480;
const H = 200;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PLOT_W = W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

function xFromDays(d: number) {
  return PAD_LEFT + (d / MAX_DAYS) * PLOT_W;
}
function yFromWeight(w: number) {
  return PAD_TOP + (1 - w) * PLOT_H;
}

export function DecayCurve() {
  // Sample 50 points
  const pts: string[] = [];
  for (let i = 0; i <= 50; i++) {
    const d = (i / 50) * MAX_DAYS;
    const w = Math.pow(0.5, d / HALF_LIFE_DAYS);
    pts.push(`${xFromDays(d).toFixed(1)},${yFromWeight(w).toFixed(1)}`);
  }
  const path = `M ${pts.join(' L ')}`;

  const markers = [
    { d: HALF_LIFE_DAYS, label: '½', wLabel: '0.50' },
    { d: HALF_LIFE_DAYS * 2, label: '¼', wLabel: '0.25' },
    { d: HALF_LIFE_DAYS * 3, label: '⅛', wLabel: '0.125' },
  ];

  return (
    <div
      className="docs-decay-curve"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper-2)',
        padding: 12,
        marginTop: 16,
        overflowX: 'auto',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Decay curve showing weight halving every ${HALF_LIFE_DAYS} days`}
        style={{ width: '100%', maxWidth: 480, height: 'auto' }}
      >
        <title>Recency decay curve</title>

        {/* Y axis gridlines + labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((w) => (
          <g key={w}>
            <line
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={yFromWeight(w)}
              y2={yFromWeight(w)}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <text
              x={PAD_LEFT - 6}
              y={yFromWeight(w) + 3}
              fontSize="9"
              textAnchor="end"
              fill="var(--muted)"
              fontFamily="var(--font-mono, monospace)"
            >
              {w.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X-axis line */}
        <line
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={H - PAD_BOTTOM}
          y2={H - PAD_BOTTOM}
          stroke="var(--ink-3)"
        />

        {/* Half-life vertical markers */}
        {markers.map((m) => (
          <g key={m.d}>
            <line
              x1={xFromDays(m.d)}
              x2={xFromDays(m.d)}
              y1={PAD_TOP}
              y2={H - PAD_BOTTOM}
              stroke="var(--sealed-text)"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <text
              x={xFromDays(m.d)}
              y={H - PAD_BOTTOM + 14}
              fontSize="9"
              textAnchor="middle"
              fill="var(--ink-3)"
              fontFamily="var(--font-mono, monospace)"
            >
              {Math.round(m.d)}d
            </text>
            <text
              x={xFromDays(m.d) + 4}
              y={yFromWeight(parseFloat(m.wLabel)) - 4}
              fontSize="11"
              fill="var(--sealed-text)"
              fontWeight="600"
              fontFamily="var(--font-mono, monospace)"
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Curve */}
        <path
          d={path}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* "today" marker at day 0 */}
        <circle
          cx={xFromDays(0)}
          cy={yFromWeight(1)}
          r="3"
          fill="var(--verified-text)"
        />
        <text
          x={xFromDays(0) + 6}
          y={yFromWeight(1) + 3}
          fontSize="9"
          fill="var(--verified-text)"
          fontFamily="var(--font-mono, monospace)"
        >
          today · 1.00
        </text>

        {/* Axis labels */}
        <text
          x={PAD_LEFT}
          y={H - 4}
          fontSize="9"
          fill="var(--muted)"
          fontFamily="var(--font-mono, monospace)"
          letterSpacing="0.8"
        >
          AGE (DAYS) →
        </text>
        <text
          x={6}
          y={PAD_TOP + 6}
          fontSize="9"
          fill="var(--muted)"
          fontFamily="var(--font-mono, monospace)"
          letterSpacing="0.8"
        >
          WEIGHT
        </text>
      </svg>
    </div>
  );
}
