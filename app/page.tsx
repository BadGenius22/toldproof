import Link from 'next/link';
import {
  Chip,
  HeroStamp,
  LiveTicker,
  PageEyebrow,
  PixelMark,
  SEAL_KEY_MARK,
  SUI_MARK,
  WALRUS_MARK,
  fakeHexBlock,
  fmtAbs,
  fmtRel,
  shortHash,
} from '../components/design';

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

export default function HomePage() {
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
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.5,
                  color: 'var(--ink-2)',
                  margin: 0,
                  textWrap: 'pretty',
                }}
              >
                Lock a prediction today. We hide the text and pick a future
                date for it to open. An AI judge reads what actually happened,
                marks it hit or miss, and saves the full reasoning forever.
                Build a record nobody can fake.
              </p>
              <div className="row" style={{ gap: 10, marginTop: 8 }}>
                <Link href="/pricing#mcp" className="btn lg">
                  For your AI agent →
                </Link>
                <Link href="/lock" className="btn lg ghost">
                  For you →
                </Link>
              </div>
              <div
                className="row"
                style={{
                  gap: 18,
                  marginTop: 12,
                  color: 'var(--muted)',
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <PixelMark bitmap={SUI_MARK} size={14} color="var(--ink-3)" /> SUI
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <PixelMark bitmap={WALRUS_MARK} size={14} color="var(--ink-3)" /> WALRUS
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <PixelMark bitmap={SEAL_KEY_MARK} size={14} color="var(--ink-3)" /> SEAL
                </span>
                <span>· no edits, no take-backs, no middleman</span>
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

          {/* Before / after */}
          <div className="mt-24" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <PageEyebrow>The difference</PageEyebrow>
            <div className="grid-2" style={{ alignItems: 'stretch' }}>
              <BeforeCard />
              <AfterCard />
            </div>
          </div>

          {/* For paid analysts — the painkiller wedge */}
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
              If you sell calls — paid newsletter, trading signal, KOL thread —
              your subscribers have no way to check your real hit rate. They
              know it. That&apos;s why retention is hard. Here&apos;s the fix.
            </p>

            <div
              className="mt-24 grid-2"
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

            <div className="row" style={{ gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <Link href="/pricing" className="btn">
                See the Pro tier →
              </Link>
              <Link href="/dewaxindo" className="btn ghost">
                See an example profile
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

          {/* AI agents can use it too */}
          <div className="mt-48">
            <PageEyebrow>For AI agents</PageEyebrow>
            <div
              className="mt-16"
              style={{
                border: '1px solid var(--ink)',
                borderRadius: 4,
                padding: '24px 28px',
                background: 'var(--paper)',
                display: 'grid',
                gap: 18,
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
              }}
            >
              <div className="col" style={{ gap: 14 }}>
                <h2 className="section">
                  Your AI agent can lock predictions here.
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14.5,
                    color: 'var(--ink-3)',
                    lineHeight: 1.55,
                  }}
                >
                  Point Claude Desktop, Cursor, or any AI agent at
                  {' '}
                  <code className="mono" style={{ color: 'var(--ink)' }}>
                    toldproof.xyz/api/mcp/mcp
                  </code>
                  {' '}— it finds our
                  {' '}
                  <code className="mono" style={{ color: 'var(--sealed)' }}>
                    seal_prediction
                  </code>
                  {' '}tool, pays $0.10 in USDC, and gets back a real
                  receipt on Sui. No wallet to install, no API key, no
                  signup. Your agent builds a public track record the same
                  way a person does.
                </p>
                <p
                  className="mono"
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: 'var(--muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  Free read tools too: get_prediction · list_predictions · get_leaderboard · verify_claim
                </p>
              </div>
              <Link href="/pricing" className="btn">
                See agent docs →
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
                glyph="⏱"
              />
              <Guarantee
                title="What"
                detail="A fingerprint of your text is saved before the open date. If even one letter changes, the check fails."
                glyph="≡"
                border
              />
              <Guarantee
                title="Who"
                detail="Locked by your Sui wallet, linked to your X handle. The handle in the tweet is the handle that signed it."
                glyph="ʘ"
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
            <span>Last updated · 2026-05-14</span>
            <span>v0.1 · sui:testnet · walrus:testnet · seal:testnet</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details
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
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {q}
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
            Told you last year ETH would do this. Been calling it since 2024.
            Anyone else see this coming? <span className="l">$ETH</span>{' '}
            <span className="l">$SOL</span>
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
            Locked prediction. Opens on {fmtAbs(SAMPLE.unlockAtMs).slice(0, 10)}.
            <br />
            <span className="l">
              toldproof.xyz/verify/{shortHash(SAMPLE.id, 6, 4)}
            </span>
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
  glyph,
  border = false,
}: {
  title: string;
  detail: string;
  glyph: string;
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
      <div className="row" style={{ gap: 12 }}>
        <span
          style={{
            fontSize: 22,
            fontFamily: 'var(--font-mono), monospace',
            color: 'var(--sealed)',
          }}
        >
          {glyph}
        </span>
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
