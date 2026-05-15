'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TweetCard } from '../../components/design';

type Scenario = 'self-seal' | 'verified' | 'no-proof';

// Order picked per UX_FIXES BT-08: self-seal first — it's the conversion
// story (someone locks a prediction because they got called out), so it
// leads. Then "it checks out", then "no proof found".
const SCENARIOS: Array<{ id: Scenario; label: string; hint: string }> = [
  {
    id: 'self-seal',
    label: 'Locks one on the spot',
    hint: 'Someone calls them out, so they lock one now.',
  },
  { id: 'verified', label: 'It checks out', hint: 'A real locked prediction matches the tweet.' },
  { id: 'no-proof', label: 'No proof found', hint: 'Nothing was locked beforehand.' },
];

export function BotScenarios() {
  const [scenario, setScenario] = useState<Scenario>('self-seal');
  const active = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0]!;

  // No page+container wrapper — the parent /bot page owns the outer
  // structure. This component is just the interactive mockup block.
  return (
    <div>
      <h2
        className="section"
        style={{ fontSize: 20, margin: '0 0 8px' }}
      >
        See the bot in action
      </h2>
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 13,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
          maxWidth: 720,
        }}
      >
        Same verdict logic as the verifier above — the bot just listens for
        mentions. Pick a scenario.
      </p>

      <div className="filter-bar" style={{ marginBottom: 14 }}>
        <div className="tabs">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenario(s.id)}
              className={`filter-tab${scenario === s.id ? ' active' : ''}`}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <span className="mono filter-hint">{active.hint}</span>
      </div>

      <div>
        {scenario === 'self-seal' && <ThreadSelfSeal />}
        {scenario === 'verified' && <ThreadVerified />}
        {scenario === 'no-proof' && <ThreadNoProof />}
      </div>
    </div>
  );
}

function ThreadVerified() {
  return (
    <div className="col" style={{ gap: 8 }}>
      <TweetCard
        name="dewaxindo"
        handle="dewaxindo"
        time="22h"
        body={
          <>
            I called it. Sui Overflow 2026 was always going to be a Walrus-track winner. Told you
            in May. <span className="l">$SUI</span>
          </>
        }
      />
      <TweetCard
        replying
        name="skeptic.sui"
        handle="skeptic_sui"
        time="18h"
        body={
          <>
            <span className="l">@toldproof</span> verify
          </>
        }
      />
      <TweetCard
        replying
        bot
        name="toldproof"
        handle="toldproof"
        time="18h"
        body={
          <>
            <span className="l">@skeptic_sui</span> verified ✓
            <br />
            <span className="mono" style={{ fontSize: 13 }}>
              Sealed: 2026-05-04 06:11 UTC
            </span>
            <br />
            <span className="mono" style={{ fontSize: 13 }}>
              Unlocked: 2026-05-12 21:14 UTC
            </span>
            <br />
            <span className="l">toldproof.xyz/verify/0xa1b2c3d4…</span>
          </>
        }
        verdict={{
          tone: 'verified',
          text: 'Locked prediction matches. The opening key was held by 2 of 3 independent operators until the open date.',
        }}
      />
    </div>
  );
}

function ThreadNoProof() {
  return (
    <div className="col" style={{ gap: 8 }}>
      <TweetCard
        name="crypto_oracle_9000"
        handle="crypto_oracle_9000"
        time="4h"
        body={
          <>
            BTC pump this week? Yeah, I literally posted this exact target back in March. Been
            calling it for months. Don&apos;t @ me.
          </>
        }
      />
      <TweetCard
        replying
        name="suspicious.eth"
        handle="suspicious_eth"
        time="3h"
        body={
          <>
            <span className="l">@toldproof</span> verify
          </>
        }
      />
      <TweetCard
        replying
        bot
        name="toldproof"
        handle="toldproof"
        time="3h"
        body={
          <>
            <span className="l">@suspicious_eth</span> no toldproof found for this claim from{' '}
            <span className="l">@crypto_oracle_9000</span>.
            <br />
            Their address has 0 sealed predictions matching &quot;BTC pump this week.&quot;
            <br />
            Show the receipt 👀 <span className="l">toldproof.xyz</span>
          </>
        }
        verdict={{
          tone: 'warn',
          text: 'Absence of proof is not proof of falsehood. Anyone can seal a prediction; @crypto_oracle_9000 has not.',
        }}
      />
    </div>
  );
}

function ThreadSelfSeal() {
  return (
    <div className="col" style={{ gap: 8 }}>
      <TweetCard
        name="analyst.move"
        handle="analyst_move"
        time="1h"
        body={
          <>
            Mark my words: <span className="l">$WAL</span> will outperform{' '}
            <span className="l">$SUI</span> for the next 30 days. Save this tweet.
          </>
        }
      />
      <TweetCard
        replying
        name="dewaxindo"
        handle="dewaxindo"
        time="48m"
        body={
          <>
            Save it on-chain or it didn&apos;t happen. <span className="l">@toldproof</span> verify
          </>
        }
      />
      <TweetCard
        replying
        bot
        name="toldproof"
        handle="toldproof"
        time="47m"
        body={
          <>
            <span className="l">@dewaxindo</span> no toldproof found for{' '}
            <span className="l">@analyst_move</span>&apos;s claim.
            <br />
            Suggest the author seals it: <span className="l">toldproof.xyz/seal</span>
          </>
        }
        verdict={{
          tone: 'warn',
          text: 'No matching sealed prediction. Defensive seal suggested.',
        }}
        action={
          <Link href="/lock" className="btn">
            Seal a prediction →
          </Link>
        }
      />
      <TweetCard
        replying
        name="analyst.move"
        handle="analyst_move"
        time="22m"
        body={
          <>
            Fine. Sealed. <span className="l">toldproof.xyz/verify/0x7f3a8c2e…</span>
          </>
        }
        verdict={{ tone: 'verified', text: "Now it's a receipt. Unlocks in 30d." }}
      />
    </div>
  );
}
