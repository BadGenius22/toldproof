// Privacy Policy — plain-English. Reflects actual product data flows:
// X OAuth, Sui address, Walrus/Sui permanence, Postgres index, reveal queue,
// bot mention dedupe, third-party AI judge.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageEyebrow, PixelMark, BRAND_MARK } from '../../components/design';

export const metadata = {
  title: 'Privacy Policy — TOLDPROOF',
  description:
    'What we collect, what we never see, who we share with, and how on-chain permanence affects your data.',
};

const LAST_UPDATED = 'May 2026';

export default function PrivacyPage() {
  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Privacy Policy</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          What we <span className="accent">see</span>, and what we don&apos;t.
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
          We collect the minimum we need to run the service: your X handle, your
          Sui address, the locked prediction text (scrambled until unlock day),
          and the small bookkeeping needed so the verify bot doesn&apos;t reply
          twice. We never see your password, your wallet&apos;s private key, or
          your X login.
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

        <Section eyebrow="1 · What we collect">
          <P>When you use TOLDPROOF, we store:</P>
          <Bullets
            items={[
              'Your X handle and X numeric user ID (so we can link tweets to predictions).',
              'Your Sui wallet address (so the on-chain receipt has an owner).',
              'The text of your prediction (kept scrambled on Walrus; unscrambled by Seal on your chosen unlock date).',
              'The unlock date, topic tag, and any optional links you attach.',
              'A short-lived session cookie after you sign in with X.',
              'A log of the verify bot’s replies — which tweet asked, which prediction matched, when we replied — so it doesn’t reply twice.',
              'Basic site analytics (page views, country, browser) via Plausible, which doesn’t use tracking cookies.',
            ]}
          />
        </Section>

        <Section eyebrow="2 · What we never see">
          <P>We do not collect, and we cannot see:</P>
          <Bullets
            items={[
              'Your X password or any other social login password.',
              'Your wallet’s private key or seed phrase — wallet signing happens in your wallet, not on our servers.',
              'Your DMs, your full timeline, or your contact list — our X OAuth scope is only what we need to read and post tweets you authorise.',
              'Any payment details. Card payments (if and when Pro launches) will run through Stripe; we never see your card number.',
            ]}
          />
        </Section>

        <Section eyebrow="3 · The permanent parts">
          <P>
            Sui and Walrus are public networks. By design, anything you write
            to them stays there forever, readable by anyone:
          </P>
          <Bullets
            items={[
              'The receipt on Sui — your address, the unlock date, a fingerprint of the prediction, hit/miss verdict once judged.',
              'The scrambled prediction text on Walrus — readable only after the unlock date, when Seal releases the key.',
              'The AI judge’s reasoning, also written to Walrus.',
            ]}
          />
          <P>
            We can&apos;t delete any of that. Neither can you. If you want a
            prediction not to be public, don&apos;t lock it. Once you click
            seal, the receipt is permanent.
          </P>
        </Section>

        <Section eyebrow="4 · The off-chain parts (deletable)">
          <P>
            We also keep a small database (Neon Postgres) to make the site fast
            and the bot reliable. This database holds:
          </P>
          <Bullets
            items={[
              'An index linking X handles to Sui addresses, so we can show predictions on a profile page.',
              'A queue of predictions waiting to unlock, so the cron job knows what to reveal.',
              'A log of bot mentions we’ve already answered, so we don’t reply to the same tweet twice.',
              'A waitlist email address, if you joined one.',
            ]}
          />
          <P>
            If you ask us to, we&apos;ll delete your row from this database —
            your profile page goes away, your leaderboard entry goes away, and
            the bot stops replying about you. The on-chain receipts remain.
            See section 8 for how to request deletion.
          </P>
        </Section>

        <Section eyebrow="5 · Who we share with">
          <P>We share data with the third parties we depend on:</P>
          <Bullets
            items={[
              'Vercel — hosts the site and runs the cron jobs.',
              'Neon — runs the Postgres database described in section 4.',
              'Mysten Labs / Sui validators — process the on-chain transactions you sign.',
              'Walrus storage nodes — store the scrambled prediction text and judge reasoning.',
              'Seal key servers — hold the time-locked key that unscrambles your prediction at the unlock time.',
              'X — receives the OAuth handshake when you sign in and the tweets we post on your behalf.',
              'Anthropic — receives the unscrambled prediction text (and any user-submitted evidence) for the AI judge to read. Anthropic doesn’t train on this data.',
              'Plausible — receives anonymised page-view stats.',
            ]}
          />
          <P>
            We don&apos;t sell your data to anyone, and we don&apos;t run ads.
          </P>
        </Section>

        <Section eyebrow="6 · Cookies and similar">
          <P>
            We use exactly one cookie: a sign-in cookie so the site remembers
            you after you connect your X account. It expires when you sign out
            or after 30 days, whichever comes first.
          </P>
          <P>
            We don&apos;t use advertising cookies. Plausible analytics works
            without cookies.
          </P>
        </Section>

        <Section eyebrow="7 · Children">
          <P>
            TOLDPROOF is not for anyone under 13 (or under 16 if you&apos;re in
            the EEA or UK). If we learn we&apos;ve stored data on someone under
            that age, we&apos;ll delete the off-chain parts and stop indexing
            their on-chain receipts.
          </P>
        </Section>

        <Section eyebrow="8 · Your rights">
          <P>You can ask us to:</P>
          <Bullets
            items={[
              'Show you what we have about you in our database.',
              'Correct anything wrong.',
              'Delete your row from our database (the on-chain receipts stay — see section 3).',
              'Stop the bot from replying about you.',
              'Take down your public profile page.',
            ]}
          />
          <P>
            Email{' '}
            <a
              href="mailto:privacy@toldproof.xyz"
              style={{ color: 'var(--ink)', textDecoration: 'underline' }}
            >
              privacy@toldproof.xyz
            </a>{' '}
            with your X handle or Sui address. We&apos;ll get back to you
            within 14 days.
          </P>
          <P>
            If you&apos;re in the EU, UK, or California, you have extra rights
            under GDPR, UK GDPR, and CCPA respectively (data portability, a
            formal complaint to your supervisory authority, etc.). The email
            above is the easiest way to use them.
          </P>
        </Section>

        <Section eyebrow="9 · How long we keep things">
          <Bullets
            items={[
              'Off-chain database rows: while your account is active, plus 30 days after deletion (for audit).',
              'Bot mention logs: 90 days, then deleted.',
              'Server logs: 30 days.',
              'On-chain receipts and Walrus blobs: forever (we can’t delete these).',
            ]}
          />
        </Section>

        <Section eyebrow="10 · International transfers">
          <P>
            Our hosting (Vercel) and database (Neon) run in the US. The Sui
            validators, Walrus storage nodes, and Seal key servers are spread
            globally. If you&apos;re in the EU/UK, your data crosses borders
            when you use TOLDPROOF — by signing up, you accept that transfer.
          </P>
        </Section>

        <Section eyebrow="11 · Security">
          <P>
            We use industry-standard practices: HTTPS everywhere, environment
            variables for secrets, no plaintext passwords (we don&apos;t have
            any — you sign in via X OAuth and Sui wallet signature).
          </P>
          <P>
            No system is perfectly secure. If we find that your data has been
            accessed by someone who shouldn&apos;t have it, we&apos;ll tell you
            within 72 hours and report it to the relevant regulators.
          </P>
        </Section>

        <Section eyebrow="12 · Changes">
          <P>
            We&apos;ll update this page when we change how we handle data. If
            we make a meaningful change, we&apos;ll refresh the &quot;Last
            updated&quot; date and post a note at the top.
          </P>
        </Section>

        <div className="mt-48 row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Link href="/lock" className="btn">
            <PixelMark bitmap={BRAND_MARK} size={14} color="var(--paper)" />
            Lock a prediction →
          </Link>
          <Link href="/terms" className="btn ghost">
            Read the terms
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
