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
      title="One Move package. Three seal paths. Three roles. Sixty-two passing tests."
      eyebrow="On Sui"
      lede={
        <p>
          The contract lives at{' '}
          <code className="mono">
            move/prediction_vault/sources/prediction_vault.move
          </code>
          . Every seal — free human, paid human, or AI agent — ends at the same shared{' '}
          <Gloss term="SealedPrediction">SealedPrediction</Gloss> object. The differences
          are who pays and which identity lock applies.
        </p>
      }
    >
      <H2 slug="three-seal-paths">Three seal paths</H2>
      <div className="grid-3" style={{ gap: 16 }}>
        <PathCard
          symbol="🟢"
          name="seal_prediction"
          who="Humans, free"
          when="First 10 predictions per month (enforced off-chain at /api/seal/preflight)"
          sig="(reg, x_handle, ...)"
        />
        <PathCard
          symbol="💵"
          name="seal_prediction_paid<T>"
          who="Humans over quota"
          when="Paid in any registered coin type T — generic over Coin<T>"
          sig="(reg, x_handle, ..., fee: Coin<T>, ...)"
        />
        <PathCard
          symbol="🤖"
          name="seal_prediction_as_agent<T>"
          who="AI agents"
          when="Always paid. Same fee table as the human paid path."
          sig="(reg, alias, ..., fee: Coin<T>, ...)"
        />
      </div>

      <H2 slug="three-roles-on-registry">Three roles on Registry</H2>
      <div className="grid-3" style={{ gap: 16 }}>
        <RoleCard
          symbol="👑"
          name="admin"
          blurb="Controls fee table and key rotations. Set to the deploying wallet at publish time."
        />
        <RoleCard
          symbol="⚖️"
          name="resolver"
          blurb="The AI Resolution Agent's signing wallet. Only this address can call resolve()."
        />
        <RoleCard
          symbol="🏦"
          name="treasury_addr"
          blurb="All paid fees auto-forward here on every seal. Separate from admin so the treasury can rotate independently."
        />
      </div>

      <H2 slug="identity-locks">Identity locks</H2>
      <p>
        First-claim-wins on every alias. A human X handle can&apos;t collide with an
        agent alias and vice versa. Agent aliases get an extra lock: the first wallet
        to seal under an alias owns that alias forever — no later wallet can
        impersonate it.
      </p>

      <H2 slug="the-seal_approve-function">The seal_approve function</H2>
      <p>
        <Gloss term="Seal">Seal</Gloss> needs an on-chain access policy that returns
        whether a given identity is allowed to decrypt. Ours is declared{' '}
        <code className="mono">entry</code>, not <code className="mono">public entry</code>{' '}
        — this means other Move packages cannot compose it. That&apos;s a deliberate
        audit recommendation from <code className="mono">/dewaxguard</code>.
      </p>
      <CodeBlock
        code={SEAL_APPROVE_SRC}
        language="move"
        filename="prediction_vault.move"
        href="https://github.com/BadGenius22/toldproof/blob/main/move/prediction_vault/sources/prediction_vault.move"
      />

      <H2 slug="reveal-hash-gate">Reveal hash gate</H2>
      <p>
        When the Reveal cron posts the decrypted plaintext on-chain, the contract
        asserts <code className="mono">sha256(plaintext) == content_hash</code>. The
        hash was committed at seal time, so even our own cron can&apos;t substitute a
        different message.
      </p>

      <div className="mt-32 grid-2" style={{ gap: 16 }}>
        <FactCard
          metric="62 / 62"
          label="Move tests passing"
          detail="Including positive + negative cases for every seal_approve branch."
        />
        <FactCard
          metric="0 / 0 / 0 / 0"
          label="Critical / High / Medium / Low (v3 audit)"
          detail="Three rounds of /dewaxguard core. v3 cleared the paid path. 3 Informational notes only."
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
