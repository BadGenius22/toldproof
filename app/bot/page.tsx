// Two pieces on this page:
//   1. <SelfServeVerify /> — live today on Free tier. Paste a tweet URL,
//      get a defamation-safe verdict reading sealed predictions from Sui.
//   2. <BotScenarios /> — mock thread examples of how the autonomous
//      @toldproof verify bot will behave once we upgrade to X API Basic
//      tier. Same verdict logic, different trigger surface.

import { PageEyebrow } from '../../components/design';
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

        {/* LIVE: self-serve verifier */}
        <div className="mt-32">
          <SelfServeVerify />
        </div>

        {/* ROADMAP: autonomous bot mockup */}
        <div className="mt-48">
          <div
            style={{
              border: '1px dashed var(--border)',
              borderRadius: 4,
              padding: '16px 20px',
              marginBottom: 24,
              background: 'var(--paper-2)',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Roadmap · ships with X API Basic tier upgrade
            </span>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 13.5,
                color: 'var(--ink-3)',
                lineHeight: 1.55,
              }}
            >
              The autonomous bot reads <code className="mono">@toldproof verify</code>{' '}
              mentions and auto-replies with the same verdict you can get
              from the verifier above. The cron job + verdict-composition
              code is already shipped (see{' '}
              <code className="mono">/api/cron/verify-bot</code>) — it just
              waits for the bearer token to activate. Mockups below show
              the planned UX.
            </p>
          </div>
          <BotScenarios />
        </div>
      </div>
    </div>
  );
}
