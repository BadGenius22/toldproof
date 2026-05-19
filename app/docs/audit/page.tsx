// /docs/audit — security audit summary. Content lifted from README §Security
// + AUDIT_REPORT_V3.md.

import Link from 'next/link';
import { DocsShell } from '../../../components/docs/DocsShell';
import { H2 } from '../../../components/docs/HeadingAnchor';

export const metadata = {
  title: 'Audit · TOLDPROOF docs',
  description:
    'Three rounds of /dewaxguard audits on the prediction_vault Move contract. v3 cleared the new paid path with 0 / 0 / 0 / 0 / 3.',
};

export default function AuditPage() {
  return (
    <DocsShell
      slug="audit"
      title="Three rounds of security review. Each one cleared before we added the next feature."
      eyebrow="Security"
      lede={
        <p>
          Every time the contract grew somewhere new bugs could hide — paid coins,
          agent names, reputation events — we ran a fresh security review on it
          before shipping. v3 is the current one; v1 and v2 are kept for the paper
          trail.
        </p>
      }
    >
      <H2 slug="current-head-v3">The latest review · v3</H2>
      <div
        style={{
          border: '1px solid var(--ink)',
          borderRadius: 4,
          padding: 24,
          background: 'var(--paper)',
          display: 'grid',
          gap: 16,
        }}
      >
        <SeverityGrid />
        <div
          style={{
            borderTop: '1px dashed var(--border)',
            paddingTop: 14,
            fontSize: 14,
            color: 'var(--ink-2)',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ fontWeight: 600 }}>What was reviewed:</strong> the new{' '}
          <code className="mono">seal_prediction_paid&lt;T&gt;</code> paid-fee
          function, plus a re-check that every bug we fixed in v2 stayed fixed.
          Contract cleared for testnet.
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <a
            href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V3.md"
            target="_blank"
            rel="noreferrer"
            className="btn"
          >
            Read v3 report on GitHub →
          </a>
        </div>
      </div>

      <H2 slug="audit-history">All three rounds · v1 → v2 → v3</H2>
      <ProgressionBar />
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--paper)',
          marginTop: 16,
        }}
      >
        <HistoryRow
          version="v1"
          counts="0 / 0 / 1 / 4 / 4"
          note="The first Move package. One medium-severity finding, four low, four notes — all fixed before v2."
          href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT.md"
        />
        <HistoryRow
          version="v2"
          counts="0 / 1 / 4 / 5 / 2"
          note="After we added Coin<T> fees, agent-name locks, separate admin/resolver/treasury keys, and reputation events. All fixed before v3 went out."
          href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V2.md"
        />
        <HistoryRow
          version="v3"
          counts="0 / 0 / 0 / 0 / 3"
          note="The current review. Only three small notes — no bugs above informational. Cleared for testnet."
          href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V3.md"
          highlight
          last
        />
      </div>
      <p
        style={{
          fontSize: 12,
          color: 'var(--muted)',
          lineHeight: 1.55,
          marginTop: 12,
        }}
      >
        Format: Critical / High / Medium / Low / Informational.
      </p>

      <H2 slug="findings-list">Every v3 finding, one by one</H2>
      <p>
        All three v3 findings were small notes. Listed here individually so
        nothing is hidden behind a count.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        <FindingRow
          sev="Info"
          title="Hardcoded testnet RPC fallback in scripts/deploy-v3.ts"
          status="Acknowledged · scripts only, not in deployed contract"
          anchor="info-1"
        />
        <FindingRow
          sev="Info"
          title="Move.lock pinned to specific framework rev"
          status="Acknowledged · matches Sui best practice for reproducible builds"
          anchor="info-2"
        />
        <FindingRow
          sev="Info"
          title="Generic-coin fee table has no upper-bound check"
          status="Acknowledged · admin-only setter, trust model documented in spec.md"
          anchor="info-3"
        />
      </div>

      <H2 slug="what-the-audit-looked-for">What the audit looked for</H2>
      <div className="grid-2" style={{ gap: 16 }}>
        <CheckCard
          title="seal_approve scope"
          detail="Confirmed entry, not public entry — other Move packages cannot compose the access policy."
        />
        <CheckCard
          title="Reveal hash gate"
          detail="sha256(plaintext) == content_hash asserted on every reveal. Cron can't substitute messages."
        />
        <CheckCard
          title="Identity locks"
          detail="First-claim-wins for humans and agents, with the extra agent-alias-to-wallet lock for impersonation resistance."
        />
        <CheckCard
          title="Role separation"
          detail="admin · resolver · treasury_addr are three distinct addresses. Compromise of one doesn't cascade."
        />
        <CheckCard
          title="Generic coin path"
          detail="seal_prediction_paid<T> works with any registered Coin<T> type and forwards correctly to the treasury."
        />
        <CheckCard
          title="Defamation safety"
          detail="lib/verify-bot.ts unit-tested — bot wording can't accidentally become accusatory."
        />
      </div>

      <H2 slug="defense-in-depth">Defense in depth (off-chain)</H2>
      <ul
        style={{
          paddingLeft: 20,
          display: 'grid',
          gap: 8,
          fontSize: 14,
          color: 'var(--ink-3)',
          lineHeight: 1.6,
        }}
      >
        <li>OAuth access + refresh tokens encrypted at rest (AES-256-GCM).</li>
        <li>Session cookies HMAC-signed, HttpOnly, Secure (prod), SameSite=Lax.</li>
        <li>PKCE on every OAuth flow.</li>
        <li>All cron routes Bearer-token gated.</li>
        <li>
          Rate-limited verification bot — max 5 verifies/day per requester to prevent
          harassment campaigns.
        </li>
      </ul>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
        <a
          href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V3.md"
          target="_blank"
          rel="noreferrer"
          className="btn"
        >
          Full v3 report →
        </a>
        <Link href="/docs" className="btn ghost">
          Back to docs index
        </Link>
      </div>
    </DocsShell>
  );
}

function SeverityGrid() {
  const sevs = [
    { label: 'Critical', count: 0, tone: 'pass' },
    { label: 'High', count: 0, tone: 'pass' },
    { label: 'Medium', count: 0, tone: 'pass' },
    { label: 'Low', count: 0, tone: 'pass' },
    { label: 'Informational', count: 3, tone: 'note' },
  ] as const;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 8,
      }}
    >
      {sevs.map((s) => (
        <SeverityCell key={s.label} {...s} />
      ))}
    </div>
  );
}

function SeverityCell({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'pass' | 'note';
}) {
  const bg = tone === 'pass' ? 'var(--verified-soft)' : 'var(--paper-2)';
  const fg = tone === 'pass' ? 'var(--verified-text)' : 'var(--ink-2)';
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '14px 10px',
        background: bg,
        display: 'grid',
        gap: 6,
        placeItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: fg,
          lineHeight: 1,
        }}
      >
        {count}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Visual progression: total findings count shrinks v1 → v2 → v3.
function ProgressionBar() {
  const rounds = [
    { label: 'v1', total: 9, sev: { C: 0, H: 0, M: 1, L: 4, I: 4 } },
    { label: 'v2', total: 12, sev: { C: 0, H: 1, M: 4, L: 5, I: 2 } },
    { label: 'v3', total: 3, sev: { C: 0, H: 0, M: 0, L: 0, I: 3 } },
  ];
  const maxTotal = 12;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginTop: 4,
      }}
    >
      {rounds.map((r) => {
        const heightPct = (r.total / maxTotal) * 100;
        return (
          <div
            key={r.label}
            style={{
              display: 'grid',
              gridTemplateRows: '120px auto',
              gap: 8,
              alignItems: 'end',
            }}
          >
            <div
              style={{
                position: 'relative',
                height: 120,
                borderBottom: '1px solid var(--ink)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
              aria-label={`${r.label}: ${r.total} findings`}
            >
              <div
                style={{
                  width: '70%',
                  height: `${heightPct}%`,
                  background:
                    'linear-gradient(to top, var(--sealed-soft), var(--verified-soft))',
                  border: '1px solid var(--border)',
                  borderBottom: 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: 6,
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {r.total}
              </div>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                textAlign: 'center',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {r.label} ·{' '}
              <span style={{ color: 'var(--ink-3)' }}>
                {r.sev.C}/{r.sev.H}/{r.sev.M}/{r.sev.L}/{r.sev.I}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryRow({
  version,
  counts,
  note,
  href,
  highlight = false,
  last = false,
}: {
  version: string;
  counts: string;
  note: string;
  href: string;
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 140px 1fr 60px',
        gap: 16,
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        background: highlight ? 'var(--paper)' : 'transparent',
        color: 'inherit',
        textDecoration: 'none',
        alignItems: 'center',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: highlight ? 'var(--ink)' : 'var(--ink-2)',
          letterSpacing: '0.04em',
        }}
      >
        {version}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 12,
          color: highlight ? 'var(--verified-text)' : 'var(--ink-3)',
          letterSpacing: '0.04em',
        }}
      >
        {counts}
      </span>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
        {note}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          textAlign: 'right',
          letterSpacing: '0.06em',
        }}
      >
        Read ↗
      </span>
    </a>
  );
}

function FindingRow({
  sev,
  title,
  status,
  anchor,
}: {
  sev: 'Info' | 'Low' | 'Medium' | 'High' | 'Critical';
  title: string;
  status: string;
  anchor: string;
}) {
  return (
    <a
      href={`https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V3.md#${anchor}`}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 14,
        alignItems: 'center',
        padding: '12px 14px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '3px 6px',
          background: 'var(--paper-2)',
          borderRadius: 3,
        }}
      >
        {sev}
      </span>
      <div style={{ display: 'grid', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          {title}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{status}</span>
      </div>
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.06em',
        }}
      >
        Read ↗
      </span>
    </a>
  );
}

function CheckCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 16,
        background: 'var(--paper)',
        display: 'grid',
        gap: 8,
      }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--verified-soft)',
            color: 'var(--verified-text)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ✓
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          {title}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
        }}
      >
        {detail}
      </p>
    </div>
  );
}
