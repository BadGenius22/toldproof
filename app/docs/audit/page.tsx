// /docs/audit — security audit summary. Content lifted from README §Security
// + AUDIT_REPORT_V3.md.

import Link from 'next/link';
import { DocsBreadcrumb, DocsFooterNav } from '../layout';

export const metadata = {
  title: 'Audit · TOLDPROOF docs',
  description:
    'Three rounds of /dewaxguard audits on the prediction_vault Move contract. v3 cleared the new paid path with 0 / 0 / 0 / 0 / 3.',
};

export default function AuditPage() {
  return (
    <div className="page">
      <div className="container">
        <DocsBreadcrumb here="Audit" />
        <h1
          className="display"
          style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', marginTop: 12, maxWidth: 780 }}
        >
          Three audit rounds. Each one cleared before adding the next path.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Every time the contract grew a new attack surface — paid coins, agent
          identities, reputation events — we ran{' '}
          <code style={{ fontFamily: 'var(--font-mono), monospace' }}>
            /dewaxguard core
          </code>{' '}
          on it before moving on. v3 is the current head; the previous two are
          archived for traceability.
        </p>

        <div className="mt-48">
          <span className="eyebrow">Current head · v3</span>
          <div
            className="mt-16"
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
              <strong style={{ fontWeight: 600 }}>Scope:</strong>{' '}
              <code style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 13 }}>
                /dewaxguard core
              </code>{' '}
              re-audit on the new{' '}
              <code style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 13 }}>
                seal_prediction_paid&lt;T&gt;
              </code>{' '}
              path plus a regression check on every fix from the v2 bundle. Contract
              cleared for testnet.
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
        </div>

        <div className="mt-48">
          <span className="eyebrow">Audit history</span>
          <div
            className="mt-16"
            style={{
              border: '1px solid var(--border)',
              borderRadius: 4,
              overflow: 'hidden',
              background: 'var(--paper)',
            }}
          >
            <HistoryRow
              version="v1"
              counts="0 / 0 / 1 / 4 / 4"
              note="Initial Move package. 1 Medium + 4 Low + 4 Info, all addressed before v2."
              href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT.md"
            />
            <HistoryRow
              version="v2"
              counts="0 / 1 / 4 / 5 / 2"
              note="After adding generic Coin<T> fees, agent identity locks, role separation, and reputation events. All addressed before v3 publish."
              href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V2.md"
            />
            <HistoryRow
              version="v3"
              counts="0 / 0 / 0 / 0 / 3"
              note="Current head. Only 3 Informational notes — contract cleared for testnet."
              href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V3.md"
              highlight
              last
            />
          </div>
          <p
            style={{
              marginTop: 12,
              fontSize: 12,
              color: 'var(--muted)',
              lineHeight: 1.55,
            }}
          >
            Format: Critical / High / Medium / Low / Informational.
          </p>
        </div>

        <div className="mt-48">
          <span className="eyebrow">What the audit looked for</span>
          <div className="mt-16 grid-2" style={{ gap: 16 }}>
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
        </div>

        <div className="mt-48">
          <span className="eyebrow">Defense in depth (off-chain)</span>
          <ul
            style={{
              marginTop: 16,
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
              Rate-limited verification bot — max 5 verifies/day per requester to
              prevent harassment campaigns.
            </li>
          </ul>
        </div>

        <div className="mt-48 row" style={{ gap: 10, flexWrap: 'wrap' }}>
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

        <DocsFooterNav
          prev={{ href: '/docs/resolution', label: 'Resolution Agent' }}
          next={null}
        />
      </div>
    </div>
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
      <div
        className="row"
        style={{ alignItems: 'center', gap: 10 }}
      >
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
