// Two pieces on this page:
//   1. <SelfServeVerify /> — live today on Free tier. Paste a tweet URL,
//      get a defamation-safe verdict reading sealed predictions from Sui.
//   2. <BotScenarios /> — mock thread examples of how the autonomous
//      @toldproof verify bot will behave once we upgrade to X API Basic
//      tier. Same verdict logic, different trigger surface.

import { Callout, PageEyebrow } from '../../components/design';
import { SelfServeVerify } from '../../components/SelfServeVerify';
import { BotScenarios } from './BotScenarios';

export default function BotPage() {
  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Verify bot · live + roadmap</PageEyebrow>
        <h1
          className="display"
          style={{
            fontSize: 'clamp(34px, 5vw, 56px)',
            marginTop: 12,
            marginBottom: 14,
          }}
        >
          Verify any &quot;I called it&quot; tweet.
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Same defamation-safe logic, two surfaces. Paste a tweet URL today
          for an instant verdict. Once we upgrade to X API Basic tier,{' '}
          <strong>@toldproof verify</strong> mentions get auto-replied — the
          examples below show what that looks like.
        </p>

        {/* LIVE: self-serve verifier — the hero, 70% above-fold (P0-6). */}
        <div className="mt-32">
          <SelfServeVerify />
        </div>

        {/* BT-07 coverage explainer — one line under the verifier. */}
        <p
          className="mono"
          style={{
            marginTop: 12,
            fontSize: 11.5,
            color: 'var(--muted)',
            lineHeight: 1.55,
            letterSpacing: '0.04em',
          }}
        >
          Triggers when someone replies <code>@toldproof verify</code> to any
          tweet. The bot checks the parent tweet&apos;s author.
        </p>

        {/* Permanent rules strip — promoted out of the scenarios sidebar so
            it's visible without scrolling past the hero (P0-6). */}
        <div
          className="mt-24"
          style={{
            padding: '14px 16px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--paper)',
          }}
        >
          <span className="eyebrow">Rules the bot follows</span>
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
            <li>It only replies when tagged. It never posts on its own.</li>
            <li>It never says someone is lying.</li>
            <li>Each person can ask up to 5 times a day.</li>
            <li>Its bio says: no proof doesn&apos;t mean false.</li>
          </ul>
        </div>

        {/* See the bot in action — demoted mockups, single-thread + tab strip. */}
        <div className="mt-48">
          <div style={{ marginBottom: 18 }}>
            <Callout eyebrow="Roadmap">
              Autonomous <code className="mono">@toldproof verify</code> reply
              ships with X API Basic tier — same verdict logic, different trigger.
            </Callout>
          </div>
          <BotScenarios />
        </div>
      </div>
    </div>
  );
}
