'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageEyebrow, TweetCard } from '../../components/design';

type Scenario = 'verified' | 'no-proof' | 'self-seal';

const SCENARIOS: Array<{ id: Scenario; label: string; hint: string }> = [
  { id: 'verified', label: 'Verified call', hint: 'Claim matches a sealed prediction.' },
  { id: 'no-proof', label: 'No proof found', hint: 'No matching seal on record.' },
  {
    id: 'self-seal',
    label: 'Defensive seal',
    hint: 'Skeptic challenges, target seals defensively.',
  },
];

export function BotScenarios() {
  const [scenario, setScenario] = useState<Scenario>('verified');

  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>The @toldproof verify bot</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          Reply to any &quot;I called it&quot; tweet.
          <br />
          The bot replies with a verdict.
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
          A Vercel cron polls X for &quot;@toldproof verify&quot; mentions every 5 minutes. The
          bot queries the on-chain Move registry for the parent tweet author&apos;s address and
          posts a reactive reply. Wording stays neutral — &quot;no toldproof found&quot; never
          &quot;this user is lying.&quot;
        </p>

        <div className="mt-32 bot-split">
          <div className="col" style={{ gap: 12 }}>
            <span className="eyebrow">Scenarios</span>
            <div className="col" style={{ gap: 8 }}>
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenario(s.id)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '12px 14px',
                    border: '1px solid',
                    borderColor: scenario === s.id ? 'var(--ink)' : 'var(--border)',
                    borderRadius: 4,
                    background: scenario === s.id ? 'var(--ink)' : 'var(--paper)',
                    color: scenario === s.id ? 'var(--paper)' : 'var(--ink)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.label}
                  </span>
                  <span className="mono" style={{ fontSize: 10.5, opacity: 0.7 }}>
                    {s.hint}
                  </span>
                </button>
              ))}
            </div>

            <div
              className="mt-24"
              style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 4 }}
            >
              <span className="eyebrow">Guardrails</span>
              <ul
                className="mono"
                style={{
                  marginTop: 10,
                  paddingLeft: 16,
                  fontSize: 11.5,
                  color: 'var(--ink-3)',
                  lineHeight: 1.7,
                }}
              >
                <li>Bot wording is reactive only.</li>
                <li>Never asserts a claim is false.</li>
                <li>Rate-limited 5/day per requester.</li>
                <li>Bot bio disclaims absence-of-proof.</li>
              </ul>
            </div>
          </div>

          <div>
            {scenario === 'verified' && <ThreadVerified />}
            {scenario === 'no-proof' && <ThreadNoProof />}
            {scenario === 'self-seal' && <ThreadSelfSeal />}
          </div>
        </div>
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
          text: 'Sealed prediction matches. Time-lock verified by 2-of-3 Seal key servers.',
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
          <Link href="/seal" className="btn">
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
