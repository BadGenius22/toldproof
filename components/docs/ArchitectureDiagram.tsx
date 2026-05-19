'use client';

// Inline interactive SVG of the TOLDPROOF end-to-end flow.
// Four lanes, seven nodes. Hover any node to highlight; the corresponding
// step row (with data-step="N") gets a synced highlight via vanilla DOM.
// Mobile (<640px) switches to a vertical stacked variant.

import { useEffect, useState } from 'react';

type Step = '01' | '02' | '03' | '04' | '05' | '06' | '07';

interface NodeSpec {
  step: Step;
  lane: number; // 0..3
  x: number; // center x
  label: string;
  sub: string;
}

const LANES = [
  { label: 'User / agent', y: 40, tone: 'var(--ink-3)' },
  { label: 'Browser · MCP', y: 120, tone: 'var(--ink-3)' },
  { label: 'Sui · Walrus · Seal', y: 200, tone: 'var(--ink-3)' },
  { label: 'AI judge', y: 280, tone: 'var(--ink-3)' },
];

const NODES: NodeSpec[] = [
  { step: '01', lane: 0, x: 80, label: 'Write', sub: '+ unlock date' },
  { step: '02', lane: 1, x: 220, label: 'Seal', sub: 'IBE encrypt' },
  { step: '03', lane: 2, x: 340, label: 'Walrus', sub: 'blob upload' },
  { step: '04', lane: 2, x: 470, label: 'Sui', sub: 'SealedPrediction' },
  { step: '05', lane: 3, x: 470, label: 'Reveal', sub: 'cron · 5 min' },
  { step: '06', lane: 3, x: 590, label: 'Resolve', sub: 'tool-use loop' },
  { step: '07', lane: 3, x: 710, label: 'Reputation', sub: 'profile chain' },
];

// (from-step, to-step, kind). Kind controls stroke style.
const LINKS: Array<[Step, Step, 'seal' | 'unlock']> = [
  ['01', '02', 'seal'],
  ['02', '03', 'seal'],
  ['03', '04', 'seal'],
  ['04', '05', 'unlock'],
  ['05', '06', 'unlock'],
  ['06', '07', 'unlock'],
];

const NODE_W = 100;
const NODE_H = 48;

export function ArchitectureDiagram() {
  const [active, setActive] = useState<Step | null>(null);

  // Cross-sync: when a step row is hovered, mirror to the diagram, and
  // vice versa. Bind once on mount. Uses data-step attribute.
  useEffect(() => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('[data-step]'),
    );
    function onRowEnter(this: HTMLElement) {
      const s = this.dataset.step as Step | undefined;
      if (s) setActive(s);
    }
    function onRowLeave() {
      setActive(null);
    }
    rows.forEach((r) => {
      r.addEventListener('mouseenter', onRowEnter);
      r.addEventListener('mouseleave', onRowLeave);
    });
    return () => {
      rows.forEach((r) => {
        r.removeEventListener('mouseenter', onRowEnter);
        r.removeEventListener('mouseleave', onRowLeave);
      });
    };
  }, []);

  // Apply CSS class to active step row.
  useEffect(() => {
    document
      .querySelectorAll<HTMLElement>('[data-step]')
      .forEach((el) => {
        if (el.dataset.step === active) {
          el.style.outline = '2px solid var(--ink)';
          el.style.background = 'var(--paper-2)';
        } else {
          el.style.outline = '';
          el.style.background = '';
        }
      });
  }, [active]);

  return (
    <div
      className="docs-arch-diagram"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper-2)',
        padding: 16,
        marginTop: 16,
        overflowX: 'auto',
      }}
    >
      <svg
        viewBox="0 0 780 340"
        role="img"
        aria-label="TOLDPROOF end-to-end flow: write, seal, store, attest, resolve, reputation"
        style={{ width: '100%', minWidth: 600, height: 'auto' }}
      >
        <title>TOLDPROOF system diagram</title>

        {/* Lanes */}
        {LANES.map((lane, i) => (
          <g key={i}>
            <line
              x1="0"
              x2="780"
              y1={lane.y + 24}
              y2={lane.y + 24}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <text
              x="0"
              y={lane.y - 4}
              fontSize="9"
              fontFamily="var(--font-mono, monospace)"
              letterSpacing="1.5"
              fill={lane.tone}
              style={{ textTransform: 'uppercase' }}
            >
              {`LANE ${i + 1} · ${lane.label}`}
            </text>
          </g>
        ))}

        {/* Links */}
        {LINKS.map(([from, to, kind], i) => {
          const a = NODES.find((n) => n.step === from)!;
          const b = NODES.find((n) => n.step === to)!;
          const ay = LANES[a.lane]!.y + NODE_H / 2;
          const by = LANES[b.lane]!.y + NODE_H / 2;
          const ax = a.x + NODE_W / 2;
          const bx = b.x - NODE_W / 2;
          const isUnlock = kind === 'unlock';
          // Quadratic bezier when crossing lanes; straight line when same lane.
          const sameLane = a.lane === b.lane;
          const d = sameLane
            ? `M${ax} ${ay} L${bx} ${by}`
            : `M${ax} ${ay} Q ${(ax + bx) / 2} ${ay} ${(ax + bx) / 2} ${(ay + by) / 2} T ${bx} ${by}`;
          const isActive = active === from || active === to;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={isUnlock ? 'var(--verified-text)' : 'var(--ink-2)'}
              strokeWidth={isActive ? 2 : 1}
              strokeDasharray={isUnlock ? '5 4' : '0'}
              markerEnd={`url(#${isUnlock ? 'arr-green' : 'arr-ink'})`}
              opacity={isActive || active === null ? 1 : 0.35}
            />
          );
        })}

        {/* Arrowhead markers */}
        <defs>
          <marker
            id="arr-ink"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-2)" />
          </marker>
          <marker
            id="arr-green"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--verified-text)" />
          </marker>
        </defs>

        {/* Nodes */}
        {NODES.map((n) => {
          const isActive = n.step === active;
          const lane = LANES[n.lane]!;
          return (
            <g
              key={n.step}
              id={`node-${n.step}`}
              role="img"
              aria-label={`Step ${n.step}: ${n.label} — ${n.sub}`}
              transform={`translate(${n.x - NODE_W / 2}, ${lane.y})`}
              onMouseEnter={() => setActive(n.step)}
              onMouseLeave={() => setActive(null)}
              style={{ cursor: 'pointer' }}
            >
              <title>{`${n.step} · ${n.label} — ${n.sub}`}</title>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx="4"
                fill={isActive ? 'var(--paper)' : 'var(--paper)'}
                stroke="var(--ink)"
                strokeWidth={isActive ? 2 : 1}
                transform={isActive ? 'scale(1.02)' : 'scale(1)'}
                style={{
                  transformOrigin: `${NODE_W / 2}px ${NODE_H / 2}px`,
                  transition: 'transform 100ms ease',
                }}
              />
              <text
                x="10"
                y="18"
                fontSize="9"
                fontFamily="var(--font-mono, monospace)"
                letterSpacing="1.2"
                fill="var(--sealed-text)"
                fontWeight="600"
              >
                {n.step}
              </text>
              <text
                x="10"
                y="32"
                fontSize="13"
                fontWeight="600"
                fill="var(--ink)"
              >
                {n.label}
              </text>
              <text
                x="10"
                y="44"
                fontSize="9.5"
                fill="var(--ink-3)"
                fontFamily="var(--font-mono, monospace)"
              >
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        className="mono"
        style={{
          marginTop: 12,
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 18,
              height: 1,
              background: 'var(--ink-2)',
            }}
          />
          Seal flow
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 18,
              height: 1,
              background:
                'repeating-linear-gradient(90deg, var(--verified-text) 0 4px, transparent 4px 8px)',
            }}
          />
          Post-unlock automation
        </span>
        <span>Hover any step above to highlight the matching node ↑</span>
      </div>
    </div>
  );
}
