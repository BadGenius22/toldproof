// /for-analysts — extracted from home (HM-03). The painkiller wedge for
// paid newsletters, trading signals, KOL threads.

import Link from 'next/link';
import { PageEyebrow } from '../../components/design';
import { getSuiClientForReads } from '../../lib/registry';
import { getTopProfile } from '../../lib/leaderboard';

export const revalidate = 60;

export const metadata = {
  title: 'For paid analysts · TOLDPROOF',
  description:
    'If you sell calls — newsletter, trading signal, KOL thread — turn your hit rate into proof your subscribers can verify.',
};

export default async function ForAnalystsPage() {
  const sampleHandle = await getTopProfile(getSuiClientForReads(), 'dewaxindo');

  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>For paid analysts and signal callers</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12, maxWidth: 760 }}
        >
          Your hit rate is just a screenshot. We turn it into proof.
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
          If you sell calls — paid newsletter, trading signal, KOL thread — your
          subscribers have no way to check your real hit rate. They know it.
          That&apos;s why retention is hard. Here&apos;s the fix.
        </p>

        <div
          className="mt-32 grid-2"
          style={{ alignItems: 'stretch', gap: 16 }}
        >
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: 20,
              background: 'var(--paper-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <span className="eyebrow">Today · what subscribers see</span>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 14,
                color: 'var(--ink-3)',
                lineHeight: 1.65,
              }}
            >
              <li>Screenshots that can be edited after the fact</li>
              <li>Old misses quietly deleted from the timeline</li>
              <li>&quot;I called it&quot; tweets posted after the move</li>
              <li>A claimed 75% hit rate they can&apos;t check</li>
            </ul>
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}
            >
              Brittle trust. High churn. Loud-but-wrong accounts win by default.
            </span>
          </div>

          <div
            style={{
              border: '1px solid var(--ink)',
              borderRadius: 4,
              padding: 20,
              background: 'var(--paper)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <span className="eyebrow">With TOLDPROOF</span>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 14,
                color: 'var(--ink-2)',
                lineHeight: 1.65,
              }}
            >
              <li>Every call locked on Sui before the answer is known</li>
              <li>Our AI judge marks each one hit or miss in public</li>
              <li>Full reasoning saved on Walrus — anyone can audit it</li>
              <li>Drop your live hit rate into Substack as one iframe</li>
            </ul>
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}
            >
              Real proof. Better retention. Subscribers stop second-guessing.
            </span>
          </div>
        </div>

        <div className="mt-32 row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Link href="/pricing" className="btn">
            See the Pro tier →
          </Link>
          <Link href={`/${sampleHandle}`} className="btn ghost">
            See @{sampleHandle}&apos;s profile
          </Link>
        </div>
      </div>
    </div>
  );
}
