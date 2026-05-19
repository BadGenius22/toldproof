// Wallet provenance card — V4 T1.1 + T1.2 surface.
//
// Lists every alias owned by the same publisher address, shows their
// per-alias Skill Score + dormancy state, and prints the wallet-aggregate
// Skill Score in the footer. The aggregate is computed via Wilson lower
// bound over the SUM of weighted hits + attempts across all aliases —
// that's the T1.2 math fix landed into T1.1 so this card stands alone.
//
// Server-side renderer; no client interactivity yet. T1.4 will add the
// trust badge pill. T1.3 will multiply each alias's contribution by a
// recency-decay factor.
//
// Spec: docs/design/V4_BUILD_SPEC_T1.md §T1.1 + §T1.2.

import Link from 'next/link';
import type { AliasSummary, WalletProvenance } from '../lib/wallet-provenance';
import { fmtRel, shortHash } from './design';
import { TrustBadge } from './TrustBadge';

interface Props {
  provenance: WalletProvenance | null;
  nowMs?: number;
}

const STATE_LABEL: Record<AliasSummary['state'], string> = {
  active: 'active',
  dormant: 'dormant',
  abandoned: 'abandoned',
};

const STATE_COLOR: Record<AliasSummary['state'], string> = {
  active: 'var(--verified)',
  dormant: 'var(--warn)',
  abandoned: 'oklch(0.55 0.18 25)',
};

const STATE_GLYPH: Record<AliasSummary['state'], string> = {
  active: '✓',
  dormant: '○',
  abandoned: '✗',
};

export function WalletProvenance({ provenance, nowMs = Date.now() }: Props) {
  // Graceful placeholder if the on-chain fetch failed or the handle has no
  // predictions yet. Surfaces the section's existence either way — its
  // *presence* is a transparency guarantee.
  if (!provenance) {
    return (
      <Card>
        <CardHeader walletShort="—" />
        <p style={{ margin: 0, padding: '16px 18px', color: 'var(--muted)' }}>
          Wallet provenance unavailable.
        </p>
      </Card>
    );
  }

  const { publisher, aliases, walletAggregateScore, bestAliasScore, badge } =
    provenance;
  const walletShort = shortHash(publisher, 6, 4);

  // Single-alias variant — keep the section visible as a guarantee, but
  // skip the alias table.
  if (aliases.length === 1) {
    const a = aliases[0]!;
    return (
      <Card>
        <CardHeader walletShort={walletShort} />
        <div style={{ padding: '14px 18px', color: 'var(--ink-2)', fontSize: 13 }}>
          <p style={{ margin: '0 0 6px' }}>
            <strong>Single alias on this wallet</strong> — no other handles
            claimed under {walletShort}.
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
            {a.calls} settled call{a.calls === 1 ? '' : 's'} ·{' '}
            {a.state === 'active' ? 'active' : `${STATE_LABEL[a.state]} ${fmtRel(a.lastActivityMs, nowMs)}`}
          </p>
        </div>
      </Card>
    );
  }

  const aggregateLabel = walletAggregateScore ?? '—';
  let deltaLine: string | null = null;
  if (walletAggregateScore !== null && bestAliasScore !== null) {
    const d = walletAggregateScore - bestAliasScore;
    if (d !== 0) {
      deltaLine = `${d > 0 ? '+' : ''}${d} vs alias-best`;
    } else {
      deltaLine = 'equal to alias-best';
    }
  }

  return (
    <Card>
      <CardHeader walletShort={walletShort} />
      <div
        style={{
          padding: '12px 18px',
          fontSize: 13,
          color: 'var(--ink-2)',
          borderBottom: '1px dashed var(--border)',
        }}
      >
        This profile is one of {aliases.length} aliases operated by wallet{' '}
        <span className="mono" style={{ color: 'var(--ink)' }}>{walletShort}</span>.
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {aliases.map((a, i) => (
          <AliasRow
            key={a.handle}
            alias={a}
            nowMs={nowMs}
            isLast={i === aliases.length - 1}
          />
        ))}
      </ul>

      {/* Footer — wallet-aggregate score (T1.2 headline number) */}
      <div
        style={{
          background: 'var(--ink)',
          color: 'var(--paper)',
          padding: '14px 18px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div className="col" style={{ gap: 4 }}>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--paper-2)',
              opacity: 0.85,
            }}
          >
            Wallet-aggregate Skill Score
          </span>
          {deltaLine && (
            <span
              className="mono"
              style={{ fontSize: 10, color: 'var(--paper-2)', opacity: 0.7 }}
            >
              {deltaLine}
            </span>
          )}
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          {badge && <TrustBadge variant={badge} />}
          <span
            className="mono"
            style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}
          >
            {aggregateLabel}
          </span>
        </div>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="mt-24"
      style={{
        border: '1px solid var(--ink)',
        borderRadius: 4,
        background: 'var(--paper)',
        overflow: 'hidden',
      }}
    >
      {children}
    </section>
  );
}

function CardHeader({ walletShort }: { walletShort: string }) {
  return (
    <header
      style={{
        background: 'var(--paper-2)',
        padding: '10px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        Wallet provenance
      </span>
      <span
        className="mono"
        style={{ fontSize: 10, color: 'var(--muted)' }}
      >
        Operated by {walletShort} · Sui
      </span>
    </header>
  );
}

function AliasRow({
  alias,
  nowMs,
  isLast,
}: {
  alias: AliasSummary;
  nowMs: number;
  isLast: boolean;
}) {
  const glyph = STATE_GLYPH[alias.state];
  const color = STATE_COLOR[alias.state];
  const stateRight = alias.isCurrent
    ? 'this page'
    : alias.state === 'active'
      ? `active · ${fmtRel(alias.lastActivityMs, nowMs)}`
      : `${STATE_LABEL[alias.state]} · ${fmtRel(alias.lastActivityMs, nowMs)}`;

  const labelHandle = alias.handle.startsWith('agent-')
    ? alias.handle
    : `@${alias.handle}`;
  const skillCell =
    alias.skillScore !== null ? `${alias.skillScore} skill` : '— skill';

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto auto',
        gap: 12,
        alignItems: 'center',
        padding: '10px 18px',
        borderBottom: isLast ? 'none' : '1px dashed var(--border)',
        fontSize: 12,
        fontFamily: 'var(--font-mono), monospace',
      }}
    >
      <span style={{ color, fontWeight: 600 }} aria-hidden>
        {glyph}
      </span>
      {alias.isCurrent ? (
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{labelHandle}</span>
      ) : (
        <Link
          href={`/${alias.handle}`}
          style={{
            color: 'var(--ink)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {labelHandle}
        </Link>
      )}
      <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        {alias.calls} {alias.calls === 1 ? 'call' : 'calls'}
      </span>
      <span
        style={{
          color: alias.skillScore !== null ? 'var(--ink-2)' : 'var(--muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {skillCell}
      </span>
      <span style={{ color, whiteSpace: 'nowrap', justifySelf: 'end' }}>
        {stateRight}
      </span>
    </li>
  );
}
