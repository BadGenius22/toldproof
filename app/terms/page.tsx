// Terms of Service — plain-English. Reflects actual product behavior:
// permanent on-chain receipts, time-locked reveals, AI judge with public
// reasoning, bot wording that never asserts a claim is false.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageEyebrow, PixelMark, BRAND_MARK } from '../../components/design';

export const metadata = {
  title: 'Terms of Service — TOLDPROOF',
  description:
    'How TOLDPROOF works, what we promise, and what you agree to when you lock a prediction.',
};

const LAST_UPDATED = 'May 2026';

export default function TermsPage() {
  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Terms of Service</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          The <span className="accent">short version</span>.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.6,
            maxWidth: 720,
          }}
        >
          You write a prediction. We lock it on Sui so nobody can change it,
          including us. On the date you picked, our AI judge opens it and marks
          it hit or miss. Everything is public and permanent. Don&apos;t use this
          to harass people, write illegal content, or pretend to be someone
          you&apos;re not.
        </p>
        <p
          className="mono"
          style={{
            marginTop: 14,
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Last updated · {LAST_UPDATED}
        </p>

        <Section eyebrow="1 · What TOLDPROOF does">
          <P>
            TOLDPROOF is a service for locking a prediction today and proving
            later that you called it. When you submit a prediction:
          </P>
          <Bullets
            items={[
              'The text gets scrambled (encrypted) and uploaded to Walrus, a public storage network.',
              'A receipt is written to the Sui blockchain — your address, the unlock date, and a fingerprint of the scrambled text.',
              'On the date you picked, our system uses Seal to unscramble the text and post the result publicly.',
              'Our AI judge reads the unscrambled prediction and marks it hit or miss, with full reasoning saved on Walrus.',
            ]}
          />
          <P>
            The receipt on Sui and the scrambled blob on Walrus are{' '}
            <strong>permanent</strong>. We can&apos;t delete them. Neither can
            you. That&apos;s the point — a receipt you can&apos;t edit later is
            the only kind worth having.
          </P>
        </Section>

        <Section eyebrow="2 · What you&apos;re agreeing to">
          <P>By locking a prediction, you confirm that:</P>
          <Bullets
            items={[
              'You wrote the prediction yourself (or an AI agent you control wrote it).',
              'You own the Sui wallet that signs for the lock.',
              'If you linked an X handle, that account belongs to you.',
              'You’re old enough where you live to sign a contract online.',
              'You understand the receipt is permanent and can’t be deleted.',
            ]}
          />
        </Section>

        <Section eyebrow="3 · What you can’t do">
          <P>You agree not to use TOLDPROOF to:</P>
          <Bullets
            items={[
              'Harass, threaten, or defame any person or group.',
              'Post anything sexual involving minors, or any other illegal content.',
              'Impersonate someone — including pretending an AI agent is human or vice versa.',
              'Try to game the leaderboard with fake or coordinated submissions.',
              'Spam predictions to drive up someone else’s loss count or harass an account.',
              'Resell access to our paid AI-agent tools without permission.',
            ]}
          />
          <P>
            If we see content that breaks these rules, we&apos;ll remove our
            public references to it (your profile listing, the leaderboard
            entry, the bot reply). The scrambled blob on Walrus and the receipt
            on Sui remain — we don&apos;t control those networks. Repeat
            violations end with your X handle and Sui address being banned from
            our index.
          </P>
        </Section>

        <Section eyebrow="4 · The AI judge">
          <P>
            On unlock day, our AI judge (Claude Sonnet by default; a three-model
            consensus if you paid for that add-on) reads the prediction and
            decides hit or miss. Its full reasoning is saved on Walrus and
            anyone can read it.
          </P>
          <P>
            The judge does its best, but it&apos;s not perfect. If you think a
            verdict is wrong, you can:
          </P>
          <Bullets
            items={[
              'Open the judge’s reasoning on the verify page and see exactly how it reached the call.',
              'File a one-line dispute from the verify page; a second judge re-reads with the same evidence.',
              'Post your counterargument with the verify link — the public record stands either way.',
            ]}
          />
          <P>
            We don&apos;t adjudicate predictions about future events that
            haven&apos;t happened yet. If your unlock date hasn&apos;t arrived,
            the judge waits.
          </P>
        </Section>

        <Section eyebrow="5 · The verify bot">
          <P>
            The <code className="mono">@toldproof</code> bot on X replies when
            someone tags it on a &quot;told you so&quot; tweet. It searches
            our index for a sealed prediction by that author that matches the
            claim.
          </P>
          <P>
            <strong>Important</strong>: the bot never says someone is lying. It
            only says &quot;sealed prediction found&quot; or &quot;no sealed
            prediction found for this claim.&quot; Absence of proof is not
            proof of falsehood — the author may have made the call somewhere
            else, or never sealed it. Read every reply that way.
          </P>
          <P>
            We rate-limit the bot to five verifications per account per day to
            prevent harassment campaigns.
          </P>
        </Section>

        <Section eyebrow="6 · Pricing and refunds">
          <P>
            Humans get 10 free predictions a month, resetting on the 1st.
            Beyond that, predictions cost $0.10 each — either by topping up in
            our app or, for AI agents, in USDC through MCP.
          </P>
          <P>
            Once a prediction is locked, the on-chain fee is gone. We can&apos;t
            refund a locked prediction because we can&apos;t undo the write to
            Sui. If you were charged for a prediction that never actually
            locked (a wallet error, a network failure before commit), email
            the address in section 11 with the timestamp and we&apos;ll refund.
          </P>
          <P>
            Pro and Reputation API tiers shown on the pricing page are on a
            waitlist and not yet billable. We&apos;ll email you separately if
            and when those go live.
          </P>
        </Section>

        <Section eyebrow="7 · No financial or legal advice">
          <P>
            TOLDPROOF is a track-record service. Predictions on the platform
            are people&apos;s personal calls — they are{' '}
            <strong>not</strong> investment advice, trading signals, legal
            opinions, medical opinions, or anything else you should act on
            without your own research. Do your own work before risking money
            on what someone else predicted.
          </P>
        </Section>

        <Section eyebrow="8 · The chains we use">
          <P>
            TOLDPROOF uses Sui (a public blockchain), Walrus (a public storage
            network on Sui), and Seal (a time-locked encryption protocol that
            uses public key servers). These are independent networks that we
            don&apos;t control.
          </P>
          <P>
            If any of those networks go down, change their rules, or get
            disrupted, our service may be affected. We&apos;ll do our best to
            keep things working, but we can&apos;t guarantee the chains
            we&apos;re built on will always be available.
          </P>
        </Section>

        <Section eyebrow="9 · Stuff we can’t promise">
          <P>
            We provide the service &quot;as is.&quot; To the extent the law
            allows, we don&apos;t make any warranty that:
          </P>
          <Bullets
            items={[
              'The site or the bot will always be up.',
              'Every AI judge verdict will be correct.',
              'The networks we depend on (Sui, Walrus, Seal, X) will always work.',
              'Reading or writing to those networks will always succeed.',
            ]}
          />
          <P>
            Our total liability to you for anything related to TOLDPROOF is
            limited to the amount you paid us in the 12 months before the
            problem (which, for almost everyone, will be zero or a few
            dollars).
          </P>
        </Section>

        <Section eyebrow="10 · Account ending">
          <P>
            You can stop using TOLDPROOF anytime. We can remove your profile
            and leaderboard listing if you ask us to — but the on-chain
            receipts and the Walrus blobs stay forever, by design.
          </P>
          <P>
            We can end your access if you break these terms. We&apos;ll tell
            you why where we reasonably can.
          </P>
        </Section>

        <Section eyebrow="11 · Contact and changes">
          <P>
            Questions, refund requests, takedowns, or anything else:{' '}
            <a
              href="mailto:hello@toldproof.xyz"
              style={{ color: 'var(--ink)', textDecoration: 'underline' }}
            >
              hello@toldproof.xyz
            </a>
            .
          </P>
          <P>
            We may update these terms. If we change something material,
            we&apos;ll note it at the top of this page and refresh the &quot;Last
            updated&quot; date. Continuing to use the service after a change
            means you accept the new version.
          </P>
        </Section>

        <div className="mt-48 row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Link href="/lock" className="btn">
            <PixelMark bitmap={BRAND_MARK} size={14} tone="on-ink" />
            Lock a prediction →
          </Link>
          <Link href="/privacy" className="btn ghost">
            Read the privacy policy
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-48" style={{ maxWidth: 760 }}>
      <PageEyebrow>{eyebrow}</PageEyebrow>
      <div className="col" style={{ gap: 12, marginTop: 12 }}>
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 14.5,
        color: 'var(--ink-2)',
        lineHeight: 1.65,
      }}
    >
      {children}
    </p>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 14,
        color: 'var(--ink-2)',
        lineHeight: 1.6,
      }}
    >
      {items.map((it) => (
        <li key={it}>{it}</li>
      ))}
    </ul>
  );
}
