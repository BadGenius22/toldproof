// /docs/move-contract — the on-chain receipt. Content lifted from README §Move contract.

import { DocsShell } from '../../../components/docs/DocsShell';
import { H2 } from '../../../components/docs/HeadingAnchor';
import { CodeBlock } from '../../../components/docs/CodeBlock';
import { Gloss } from '../../../components/docs/Gloss';

export const metadata = {
  title: 'Move contract · TOLDPROOF docs',
  description:
    'The prediction_vault Sui Move package — three seal paths, three roles, 62 passing tests, audited.',
};

const SEAL_APPROVE_SRC = `entry fun seal_approve(
    id: vector<u8>,
    sealed: &SealedPrediction,
    clock: &Clock,
) {
    // identity = [package_id][bcs::to_bytes(unlock_ms)]
    // reject if clock.timestamp_ms() < sealed.unlock_at
    // reject if identity prefix != this package id
    // reject if id != expected identity for this object
}`;

export default function MoveContractPage() {
  return (
    <DocsShell
      slug="move-contract"
      title="One on-Sui program. Three ways to lock. Three keys with different powers. Sixty-two passing tests."
      eyebrow="On Sui"
      lede={
        <p>
          The program lives at{' '}
          <code className="mono">
            move/prediction_vault/sources/prediction_vault.move
          </code>
          . Every lock — free human, paid human, or AI agent — ends at the same shared{' '}
          <Gloss term="SealedPrediction">SealedPrediction</Gloss> receipt. The
          differences are who pays and which name-lock applies.
        </p>
      }
    >
      <H2 slug="three-seal-paths">Three ways to lock</H2>
      <div className="grid-3" style={{ gap: 16 }}>
        <PathCard
          symbol="🟢"
          name="seal_prediction"
          who="Humans"
          when="The human seal path — $1 per lock, paid in USDC from the wallet."
          sig="(reg, x_handle, ...)"
        />
        <PathCard
          symbol="💵"
          name="seal_prediction_paid<T>"
          who="Paid human seals"
          when="Pay the $1 fee in a supported coin (USDC). The same function handles SUI, USDC, etc. — but only coins admin has explicitly added to the fee table are accepted. Made-up tokens get rejected."
          sig="(reg, x_handle, ..., fee: Coin<T>, ...)"
        />
        <PathCard
          symbol="🤖"
          name="seal_prediction_as_agent<T>"
          who="AI agents"
          when="$1 per seal — the same price as humans. Same fee table as the human paid version."
          sig="(reg, alias, ..., fee: Coin<T>, ...)"
        />
      </div>

      <H2 slug="three-roles-on-registry">Three keys with different powers</H2>
      <div className="grid-3" style={{ gap: 16 }}>
        <RoleCard
          symbol="👑"
          name="admin"
          blurb="Sets fee amounts and swaps the other two keys if needed. Set to the deploying wallet on day one."
        />
        <RoleCard
          symbol="⚖️"
          name="resolver"
          blurb="The AI judge's signing wallet. Only this address can stamp a hit-or-miss verdict."
        />
        <RoleCard
          symbol="🏦"
          name="treasury_addr"
          blurb="All paid fees auto-forward here on every lock. Kept separate from admin so the destination can move without touching admin powers."
        />
      </div>

      <H2 slug="identity-locks">Name locks</H2>
      <p>
        First wallet to claim a name wins it. A human X handle and an agent name
        can&apos;t collide, ever. Agent names get an extra lock: the first wallet
        to lock a prediction under an agent name owns that name forever — no
        later wallet can impersonate it.
      </p>

      <H2 slug="the-seal_approve-function">The seal_approve gate</H2>
      <p>
        <Gloss term="Seal">Seal</Gloss> needs a function on Sui that says
        &ldquo;yes, this person can decrypt now&rdquo; or &ldquo;no, not yet.&rdquo;
        Ours is marked <code className="mono">entry</code>, not{' '}
        <code className="mono">public entry</code> — that one keyword stops other
        Sui programs from calling it as a building block. The security review
        specifically flagged this as the right choice.
      </p>
      <CodeBlock
        code={SEAL_APPROVE_SRC}
        language="move"
        filename="prediction_vault.move"
        href="https://github.com/BadGenius22/toldproof/blob/main/move/prediction_vault/sources/prediction_vault.move"
      />

      <H2 slug="reveal-hash-gate">Open-time fingerprint check</H2>
      <p>
        When our Reveal job posts the decrypted text on Sui, the program checks
        that <code className="mono">sha256(plaintext) == content_hash</code> — the
        fingerprint must match the one we wrote down at lock time. So even our own
        job can&apos;t swap in a different message later.
      </p>

      <div className="mt-32 grid-2" style={{ gap: 16 }}>
        <FactCard
          metric="62 / 62"
          label="Move tests passing"
          detail="Including tests for every way the seal_approve gate should say yes AND every way it should say no."
        />
        <FactCard
          metric="0 / 0 / 0 / 0"
          label="Critical / High / Medium / Low (v3 review)"
          detail="Three rounds of security review. v3 cleared the new paid path. Three small notes only — no bugs above informational."
        />
      </div>
    </DocsShell>
  );
}

function PathCard({
  symbol,
  name,
  who,
  when,
  sig,
}: {
  symbol: string;
  name: string;
  who: string;
  when: string;
  sig: string;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 18,
        background: 'var(--paper)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 22 }} aria-hidden>
        {symbol}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 13,
          color: 'var(--ink)',
          fontWeight: 600,
          letterSpacing: '0.02em',
          wordBreak: 'break-all',
        }}
      >
        {name}
      </div>
      <div className="eyebrow" style={{ marginTop: 2 }}>
        {who}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
        }}
      >
        {when}
      </p>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.02em',
          background: 'var(--paper-2)',
          padding: '6px 8px',
          borderRadius: 3,
          wordBreak: 'break-all',
        }}
      >
        {sig}
      </div>
    </div>
  );
}

function RoleCard({
  symbol,
  name,
  blurb,
}: {
  symbol: string;
  name: string;
  blurb: string;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 18,
        background: 'var(--paper-2)',
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 22 }} aria-hidden>
        {symbol}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 14,
          color: 'var(--ink)',
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}
      >
        {name}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
        }}
      >
        {blurb}
      </p>
    </div>
  );
}

function FactCard({
  metric,
  label,
  detail,
}: {
  metric: string;
  label: string;
  detail: string;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--ink)',
        borderRadius: 4,
        padding: 22,
        background: 'var(--paper)',
        display: 'grid',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}
      >
        {metric}
      </div>
      <div className="eyebrow">{label}</div>
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
