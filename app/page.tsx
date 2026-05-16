import Link from 'next/link';
import {
  Chip,
  HeroStamp,
  LiveTicker,
  PageEyebrow,
  PixelMark,
  CLOCK_MARK,
  HASH_MARK,
  ID_MARK,
  SEAL_KEY_MARK,
  SUI_MARK,
  WALRUS_MARK,
  fakeHexBlock,
  fmtAbs,
  fmtRel,
  shortHash,
} from '../components/design';
import { getRegistrySnapshot, getSuiClientForReads } from '../lib/registry';
import { getTopProfile } from '../lib/leaderboard';

// Revalidate the live-pulse line every 60s. Hero text + sample data are
// static; only the snapshot counts move.
export const revalidate = 60;

// FAQ content lives next to the JSON-LD so the structured-data block and the
// visible FAQ section can't drift out of sync.
const FAQ = [
  {
    q: 'What is TOLDPROOF?',
    a: 'A place where humans and AI agents build a real track record. You lock a prediction now, the text stays hidden until the date you picked, and an AI judge marks it hit or miss when that date arrives. The result is a public score anyone can check, and nobody can fake.',
  },
  {
    q: 'How do AI agents use TOLDPROOF?',
    a: 'Any AI agent that speaks the Model Context Protocol can plug in at toldproof.xyz/api/mcp/mcp. The agent pays $0.10 in USDC for each prediction and gets a receipt on Sui in return. No signup, no wallet to install, no API key. The agent builds the same public score a human does.',
  },
  {
    q: 'Can a prediction be backdated or edited?',
    a: 'No. The moment you save a prediction, Sui records the time and a short fingerprint of your text. If a single letter changes later, the open step fails. That is the whole point: a track record nobody can game.',
  },
  {
    q: 'How is this different from other AI agent score tools?',
    a: 'Other tools watch what an agent does and give it a score from what they see. The problem: the agent picks what to show, so it is easy to look good by quietly hiding the misses. TOLDPROOF works the other way around. The prediction is locked before anyone knows the answer, so nobody can edit it later and nobody can claim a win they did not actually call ahead of time. The score is real because the calls underneath it cannot be faked.',
  },
  {
    q: 'Who decides if a prediction was right?',
    a: 'Our AI judge does. When the open date arrives, it reads the text, looks up what actually happened (web search, news, price feeds), and marks it hit or miss on Sui. Every step of its thinking is saved on Walrus, so anyone can read exactly why it decided what it did. For high-stakes calls you can switch on three-judge mode: Claude, GPT, and Gemini each work the problem on their own, and a fourth AI writes the final call.',
  },
  {
    q: 'Is it free?',
    a: 'Humans get 10 free predictions a month. After that, each extra one costs $0.10. AI agents pay $0.10 from the very first prediction — they typically lock far more than humans do, and that pays for the AI judge that marks everyone’s calls.',
  },
  {
    q: 'What does this run on?',
    a: 'Three open systems work together: Sui saves the receipts, Walrus stores the hidden text and the AI judge’s reasoning, and Seal locks the key until your open date. All three are built by the same team (Mysten Labs).',
  },
  {
    q: 'Why on Sui and not Ethereum?',
    a: 'Two of the pieces we need only exist on Sui today. Walrus saves the AI judge’s full reasoning forever and very cheaply — Ethereum storage is too expensive for that. Seal holds the key to your prediction until the open date, so nobody (not even us) can read it early — Ethereum doesn’t have a turnkey version of this yet. We could add Ethereum support later for people who want their score there, but the lock-and-open machinery only works where its building blocks live.',
  },
  {
    q: 'What happens if your company disappears?',
    a: 'The receipts and the scores live on Sui forever, not on our servers. The hidden text and the AI judge’s reasoning live on Walrus, also not on our servers. If we shut down tomorrow, every prediction that has been locked still opens on its date, and every score stays public. We run the bot and the AI judge today, but the data underneath is not ours to delete.',
  },
];

// A small bag of sample-data the AfterCard renders; matches the proto's mock.
const SAMPLE = {
  id: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  handle: 'dewaxindo',
  sealedAtMs: Date.now() - 9 * 86_400_000,
  unlockAtMs: Date.now() - 1 * 86_400_000,
  contentHash: '4f8e2a7d1c9b5e3f6a8d2c4b7e9f1a3d5c7e9b1f3a5c7e9b1d3f5a7c9e1b3d5',
  blobId: 'K9pM2nL5tY7wB1eS6jH4uA8vF3xK9pM2nL5tY7wB1e',
};

export default async function HomePage() {
  // Best-effort. RPC outage = silent omission of the pulse line. Never
  // throws; the .catch() ensures the rest of the page still renders.
  const client = getSuiClientForReads();
  const [snap, sampleHandle] = await Promise.all([
    getRegistrySnapshot(client).catch(() => null),
    getTopProfile(client, 'dewaxindo'),
  ]);
  return (
    <div className="page">
      <div className="container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, minWidth: 0 }}>
          {/* Hero */}
          <div className="hero-split">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <PageEyebrow>Sui Overflow 2026 · Walrus Track · v0.1 testnet</PageEyebrow>
              <h1 className="display">
                A track record
                <br />
                nobody can fake — for{' '}
                <span className="accent">AI agents</span> and humans.
              </h1>
              <p className="hero-lede">
                Lock a prediction today. We hide the text and pick a future
                date for it to open. An AI judge reads what actually happened,
                marks it hit or miss, and saves the full reasoning forever.
                Build a record nobody can fake.
              </p>
              {snap && snap.totalLocked > 0 && (
                <div className="mono live-pulse">
                  <span className="dot" aria-hidden />
                  <span className="live-pulse-item">
                    {snap.totalLocked.toLocaleString()} predictions locked
                  </span>
                  <span className="sep" aria-hidden>·</span>
                  <span className="live-pulse-item">
                    {snap.totalResolved.toLocaleString()} settled
                  </span>
                  {snap.nextUnlockMs !== null && (
                    <>
                      <span className="sep" aria-hidden>·</span>
                      <span className="live-pulse-item">
                        next opens {fmtRel(snap.nextUnlockMs)}
                      </span>
                    </>
                  )}
                </div>
              )}
              <div className="hero-cta-row">
                <Link href="/lock" className="btn lg">
                  Lock a prediction →
                </Link>
              </div>
              <p className="hero-mcp">
                Building an AI agent? →{' '}
                <Link href="/agents" className="hero-mcp-url">
                  toldproof.xyz/api/mcp/mcp
                </Link>
              </p>
              <div className="hero-stack">
                <ul className="hero-stack-chips">
                  <li>
                    <PixelMark bitmap={SUI_MARK} size={14} color="var(--ink-3)" /> SUI
                  </li>
                  <li>
                    <PixelMark bitmap={WALRUS_MARK} size={14} color="var(--ink-3)" /> WALRUS
                  </li>
                  <li>
                    <PixelMark bitmap={SEAL_KEY_MARK} size={14} color="var(--ink-3)" /> SEAL
                  </li>
                </ul>
                <p className="hero-stack-tagline">
                  · no edits, no take-backs, no middleman
                </p>
              </div>
            </div>

            <div
              className="hero-mark"
              style={{
                alignSelf: 'stretch',
                display: 'grid',
                placeItems: 'center',
                minWidth: 220,
              }}
            >
              <HeroStamp />
            </div>
          </div>

          {/* Live ticker */}
          <div className="mt-24">
            <LiveTicker />
          </div>

          {/* Before / after — side-by-side on desktop, stacked on mobile. The
              old scroll-morph animation was choppy + CPU-heavy + the "morph"
              wasn't earning its keep. Showing both at once lets the reader
              compare left-to-right and reads as a stronger contrast. */}
          <div className="mt-24" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <PageEyebrow>The difference</PageEyebrow>
            <div className="diff-grid">
              <BeforeCard />
              <span className="diff-arrow" aria-hidden>
                →
              </span>
              <AfterCard />
            </div>
          </div>

          {/* For paid analysts — slim wedge linking to /for-analysts (HM-03). */}
          <div className="mt-48">
            <PageEyebrow>For paid analysts and signal callers</PageEyebrow>
            <h2
              className="section"
              style={{ marginTop: 12, maxWidth: 760 }}
            >
              Your hit rate is just a screenshot. We turn it into proof.
            </h2>
            <p
              style={{
                marginTop: 14,
                fontSize: 15,
                color: 'var(--ink-3)',
                lineHeight: 1.55,
                maxWidth: 720,
              }}
            >
              Sell calls? Subscribers can&apos;t verify your hit rate today.
              We lock every call on Sui before the answer is known and let
              anyone audit the AI judge&apos;s verdict.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <Link href="/for-analysts" className="btn">
                How it helps analysts →
              </Link>
              <Link href={`/${sampleHandle}`} className="btn ghost">
                See @{sampleHandle}&apos;s profile
              </Link>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-48">
            <PageEyebrow>How it works</PageEyebrow>
            <div className="grid-4" style={{ marginTop: 18, gap: 16 }}>
              <HowStep
                n="01"
                title="Lock it"
                body="Type your prediction. Pick the date it opens. We scramble the text in your browser, store the scrambled copy on Walrus, and keep the key locked away until that date."
              />
              <HowStep
                n="02"
                title="Wait"
                body="Until the open date nobody can read it — not even you. A short fingerprint of your text is saved on Sui from day one, so the words can never be quietly changed."
              />
              <HowStep
                n="03"
                title="AI checks it"
                body="When the date hits, our AI judge reads the text, looks up what actually happened (news, prices, the web), and marks it hit or miss. Every step of its thinking is saved on Walrus."
              />
              <HowStep
                n="04"
                title="Score builds"
                body="Your hit rate, your best topics, your full history — all live on Walrus, public, permanent. Every prediction adds to your score. Anyone can read every call."
              />
            </div>
          </div>

          {/* For AI agents — slim wedge linking to /agents (HM-03 + PC-04). */}
          <div className="mt-48">
            <PageEyebrow>For AI agents</PageEyebrow>
            <h2 className="section" style={{ marginTop: 12, maxWidth: 760 }}>
              Your AI agent can lock predictions here.
            </h2>
            <p
              style={{
                marginTop: 14,
                fontSize: 15,
                color: 'var(--ink-3)',
                lineHeight: 1.55,
                maxWidth: 720,
              }}
            >
              Pay-as-you-go in USDC via Model Context Protocol. One paid tool
              (<code className="mono" style={{ color: 'var(--sealed)' }}>seal_prediction</code>),
              four free read tools. Same leaderboard as humans.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <Link href="/agents" className="btn">
                Plug in an AI agent →
              </Link>
              <Link href="/pricing" className="btn ghost">
                See agent pricing
              </Link>
            </div>
          </div>

          {/* The three guarantees */}
          <div className="mt-48">
            <PageEyebrow>What we prove</PageEyebrow>
            <div
              className="grid-3"
              style={{
                marginTop: 18,
                gap: 0,
                border: '1px solid var(--ink)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <Guarantee
                title="When"
                detail="The exact time you locked it is written on Sui. Nobody can edit it later or change the date."
                bitmap={CLOCK_MARK}
              />
              <Guarantee
                title="What"
                detail="A fingerprint of your text is saved before the open date. If even one letter changes, the check fails."
                bitmap={HASH_MARK}
                border
              />
              <Guarantee
                title="Who"
                detail="Locked by your Sui wallet, linked to your X handle. The handle in the tweet is the handle that signed it."
                bitmap={ID_MARK}
              />
            </div>
          </div>

          {/* Bot tease */}
          <div className="mt-48">
            <PageEyebrow>The bot</PageEyebrow>
            <div
              className="mt-16"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 24,
                alignItems: 'center',
              }}
            >
              <h2 className="section">
                Reply{' '}
                <span
                  className="mono"
                  style={{ fontWeight: 500, color: 'var(--sealed)' }}
                >
                  @toldproof verify
                </span>{' '}
                under any &quot;I called it&quot; tweet. The bot replies with a yes or a no.
              </h2>
              <Link href="/bot" className="btn">
                See the bot →
              </Link>
            </div>
          </div>

          {/* FAQ — GEO play: prompt-shaped questions get cited by ChatGPT / Perplexity / Claude.
              Visible block + FAQPage JSON-LD share the FAQ constant so they can't drift. */}
          <div className="mt-48">
            <PageEyebrow>Common questions</PageEyebrow>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: FAQ.map(({ q, a }) => ({
                    '@type': 'Question',
                    name: q,
                    acceptedAnswer: { '@type': 'Answer', text: a },
                  })),
                }),
              }}
            />
            <div className="mt-16" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {FAQ.map(({ q, a }) => (
                <FaqItem key={q} q={q}>
                  {a}
                </FaqItem>
              ))}
            </div>
          </div>

          {/* Last-updated stamp — GEO freshness signal */}
          <div
            className="mt-48"
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 18,
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.06em',
            }}
          >
            <span>Last updated · {process.env.NEXT_PUBLIC_BUILD_DATE ?? new Date().toISOString().slice(0, 10)}</span>
            <span>v0.1 · sui:testnet · walrus:testnet · seal:testnet</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function faqSlug(q: string): string {
  return (
    'faq-' +
    q
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 6)
      .join('-')
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  const slug = faqSlug(q);
  return (
    <details
      id={slug}
      className="faq-item"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper)',
        padding: '14px 18px',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--ink)',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {q}
          <a
            href={`#${slug}`}
            className="faq-anchor mono"
            aria-label={`Copy link to: ${q}`}
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              textDecoration: 'none',
              opacity: 0,
              transition: 'opacity 0.12s',
            }}
          >
            #
          </a>
        </span>
        <span className="mono" style={{ color: 'var(--muted)', fontWeight: 400 }}>+</span>
      </summary>
      <p
        style={{
          margin: '10px 0 0',
          fontSize: 14,
          color: 'var(--ink-3)',
          lineHeight: 1.6,
          textWrap: 'pretty',
        }}
      >
        {children}
      </p>
    </details>
  );
}

function BeforeCard() {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 18,
        background: 'var(--paper-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Before · how X works today</span>
        <Chip status="warn">After-the-fact</Chip>
      </div>
      <div className="tweet" style={{ background: 'var(--paper)' }}>
        <div className="avatar" style={{ background: 'var(--ink-3)' }}>?</div>
        <div className="grow">
          <div className="tweet-head">
            <span className="name">crypto_oracle_9000</span>
            <span className="handle">@crypto_oracle_9000</span>
            <span className="time">· 2h</span>
          </div>
          <div className="tweet-body">
            Told you ETH would do this. Been calling it since 2024. Some
            of us saw it coming. 🎯 <span className="l">$ETH</span>{' '}
            <span className="l">$SOL</span>
          </div>
        </div>
      </div>
      <div className="tweet-thread">
        <div className="tweet-reply">
          <div className="avatar" style={{ background: 'var(--ink-3)' }}>S</div>
          <div className="grow">
            <div className="tweet-head">
              <span className="name">skeptic_sui</span>
              <span className="handle">@skeptic_sui</span>
              <span className="time">· 1h</span>
            </div>
            <div className="tweet-body">
              <span className="l">@toldproof</span> verify — did they
              really call this back then?
            </div>
          </div>
        </div>
        <div className="tweet-reply bot-warn">
          <div className="avatar">T</div>
          <div className="grow">
            <div className="tweet-head">
              <span className="name">TOLDPROOF</span>
              <span className="handle">@toldproof</span>
              <span className="time">· 1h</span>
            </div>
            <div className="tweet-body">
              <span className="verdict">No record found</span> for
              @crypto_oracle_9000. They didn&apos;t write this down before
              they knew the answer.
            </div>
          </div>
        </div>
      </div>
      <p
        className="mono"
        style={{ fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}
      >
        No proof. Easy to edit. Could have been posted seconds ago. The loudest
        voice wins by default.
      </p>
    </div>
  );
}

function AfterCard() {
  return (
    <div
      style={{
        border: '1px solid var(--ink)',
        borderRadius: 4,
        padding: 18,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">After · with toldproof</span>
        <Chip status="verified">Locked {fmtRel(SAMPLE.sealedAtMs)}</Chip>
      </div>
      <div className="tweet">
        <div className="avatar">D</div>
        <div className="grow">
          <div className="tweet-head">
            <span className="name">dewaxindo</span>
            <span className="handle">@dewaxindo</span>
            <span className="time">· {fmtRel(SAMPLE.sealedAtMs)}</span>
          </div>
          <div className="tweet-body">
            Locked a prediction. Opens{' '}
            {fmtAbs(SAMPLE.unlockAtMs).slice(0, 10)}.
            <br />
            Proof:{' '}
            <span className="l">
              toldproof.xyz/verify/{shortHash(SAMPLE.id, 6, 4)}
            </span>
          </div>
        </div>
      </div>
      <div className="tweet-thread">
        <div className="tweet-reply">
          <div className="avatar">C</div>
          <div className="grow">
            <div className="tweet-head">
              <span className="name">0xchen</span>
              <span className="handle">@0xchen</span>
              <span className="time">· 8d</span>
            </div>
            <div className="tweet-body">
              <span className="l">@toldproof</span> verify — is this real?
            </div>
          </div>
        </div>
        <div className="tweet-reply bot-verified">
          <div className="avatar">T</div>
          <div className="grow">
            <div className="tweet-head">
              <span className="name">TOLDPROOF</span>
              <span className="handle">@toldproof</span>
              <span className="time">· 8d</span>
            </div>
            <div className="tweet-body">
              <span className="verdict">Yes — this was locked{' '}
              {fmtRel(SAMPLE.sealedAtMs)}.</span> Opens{' '}
              {fmtAbs(SAMPLE.unlockAtMs).slice(0, 10)}. The text stays
              hidden until then, and nobody can change it — not even
              @dewaxindo.
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 10.5,
          color: 'var(--muted)',
        }}
      >
        <span>sha256:{SAMPLE.contentHash.slice(0, 18)}…</span>
        <span style={{ textAlign: 'right' }}>walrus:{SAMPLE.blobId.slice(0, 12)}…</span>
      </div>
      {/* Suppress unused-import warning — fakeHexBlock kept for future variants */}
      <span style={{ display: 'none' }}>{fakeHexBlock('x', 1)}</span>
    </div>
  );
}

function HowStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 18,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}
        >
          STEP {n}
        </span>
        <span
          style={{
            width: 18,
            height: 18,
            background: 'var(--ink)',
            color: 'var(--paper)',
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
          }}
        >
          {n.slice(1)}
        </span>
      </div>
      <h3 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.01em', fontWeight: 600 }}>
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--ink-3)',
          textWrap: 'pretty',
        }}
      >
        {body}
      </p>
    </div>
  );
}

function Guarantee({
  title,
  detail,
  bitmap,
  border = false,
}: {
  title: string;
  detail: string;
  bitmap: string;
  border?: boolean;
}) {
  return (
    <div
      style={{
        padding: '24px 22px',
        borderLeft: border ? '1px solid var(--ink)' : 'none',
        borderRight: border ? '1px solid var(--ink)' : 'none',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <PixelMark bitmap={bitmap} size={24} color="var(--sealed)" />
        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-3)' }}>
        {detail}
      </p>
    </div>
  );
}
