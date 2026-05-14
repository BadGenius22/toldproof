// Brand kit — five lockups, ecosystem glyphs, OG share preview, color tokens.

import type { ReactNode } from 'react';
import {
  PageEyebrow,
  PixelMark,
  BIG_SEAL,
  BRAND_MARK,
  SEAL_KEY_MARK,
  SUI_MARK,
  WALRUS_MARK,
} from '../../components/design';

export default function BrandPage() {
  const pickedMark = BRAND_MARK;

  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Brand kit</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          One mark. Five lockups.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 680,
          }}
        >
          The pixel wax-seal is the signature. It works as a standalone mark, locked up
          horizontally with the wordmark, vertically stacked, or stamped into a sealed-scroll
          frame for share previews.
        </p>

        <div className="mt-48 grid-2" style={{ gap: 20 }}>
          <LockupCard label="Mark only · primary">
            <PixelMark bitmap={pickedMark} size={120} color="var(--ink)" />
          </LockupCard>

          <LockupCard label="Mark only · amber">
            <PixelMark bitmap={pickedMark} size={120} color="var(--sealed)" />
          </LockupCard>

          <LockupCard label="Horizontal lockup">
            <div className="row" style={{ gap: 16 }}>
              <PixelMark bitmap={pickedMark} size={64} color="var(--ink)" />
              <span
                style={{
                  fontFamily: 'var(--font-mono), monospace',
                  fontWeight: 600,
                  fontSize: 32,
                  letterSpacing: '0.18em',
                  color: 'var(--ink)',
                }}
              >
                TOLDPROOF
              </span>
            </div>
          </LockupCard>

          <LockupCard label="Vertical lockup">
            <div className="col" style={{ gap: 10, alignItems: 'center' }}>
              <PixelMark bitmap={pickedMark} size={72} color="var(--ink)" />
              <span
                style={{
                  fontFamily: 'var(--font-mono), monospace',
                  fontWeight: 600,
                  fontSize: 18,
                  letterSpacing: '0.22em',
                  color: 'var(--ink)',
                }}
              >
                TOLDPROOF
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  color: 'var(--muted)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Cryptographic receipts
              </span>
            </div>
          </LockupCard>

          <LockupCard label="Wax-seal lockup · OG share">
            <div
              style={{
                transform: 'rotate(-4deg)',
                padding: 18,
                border: '3px solid var(--ink)',
                borderRadius: 6,
                background: 'var(--paper)',
                boxShadow: '4px 4px 0 var(--ink)',
                display: 'grid',
                gap: 8,
                placeItems: 'center',
              }}
            >
              <PixelMark bitmap={BIG_SEAL} size={70} color="var(--ink)" />
              <span
                className="mono"
                style={{
                  fontSize: 8,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  borderTop: '1px dashed var(--ink)',
                  paddingTop: 4,
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                Sui · Walrus · Seal
              </span>
            </div>
          </LockupCard>

          <LockupCard label="Inverted · dark backdrop">
            <div
              style={{
                padding: '32px 28px',
                background: 'var(--ink)',
                borderRadius: 4,
                display: 'grid',
                placeItems: 'center',
                minWidth: 200,
              }}
            >
              <div className="row" style={{ gap: 14 }}>
                <PixelMark bitmap={pickedMark} size={48} color="var(--sealed)" />
                <span
                  style={{
                    fontFamily: 'var(--font-mono), monospace',
                    fontWeight: 600,
                    fontSize: 22,
                    letterSpacing: '0.16em',
                    color: 'var(--paper)',
                  }}
                >
                  TOLDPROOF
                </span>
              </div>
            </div>
          </LockupCard>
        </div>

        <div className="mt-48">
          <PageEyebrow>Ecosystem glyphs</PageEyebrow>
          <div className="mt-16 grid-3" style={{ gap: 16 }}>
            <GlyphCard label="Sui" mark={SUI_MARK} />
            <GlyphCard label="Walrus" mark={WALRUS_MARK} />
            <GlyphCard label="Seal" mark={SEAL_KEY_MARK} />
          </div>
        </div>

        <div className="mt-48">
          <PageEyebrow>Open Graph share preview · 1200×630</PageEyebrow>
          <div
            className="mt-16"
            style={{
              border: '1px solid var(--border)',
              borderRadius: 4,
              overflow: 'hidden',
              aspectRatio: '1200 / 630',
              background: 'var(--paper)',
              position: 'relative',
              backgroundImage:
                'linear-gradient(to right, rgba(20,19,15,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(20,19,15,0.04) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '8%',
                top: '16%',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                maxWidth: '60%',
              }}
            >
              <PixelMark bitmap={BRAND_MARK} size={56} color="var(--ink)" />
              <div
                style={{
                  fontFamily: 'var(--font-sans), sans-serif',
                  fontSize: 'clamp(28px, 4.8vw, 64px)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.05,
                  textWrap: 'balance',
                  color: 'var(--ink)',
                }}
              >
                Sealed prediction.<br />Verifies in 41 days.
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 'clamp(11px, 1.2vw, 14px)',
                  color: 'var(--muted)',
                  letterSpacing: '0.08em',
                }}
              >
                toldproof.xyz/verify/0x7f3a8c2e…
              </div>
            </div>
            <div
              style={{
                position: 'absolute',
                right: '6%',
                top: '10%',
                transform: 'rotate(-6deg)',
              }}
            >
              <div
                style={{
                  padding: 14,
                  border: '3px solid var(--ink)',
                  borderRadius: 6,
                  background: 'var(--paper)',
                  boxShadow: '4px 4px 0 var(--sealed)',
                  display: 'grid',
                  placeItems: 'center',
                  gap: 6,
                }}
              >
                <PixelMark bitmap={BIG_SEAL} size={80} color="var(--ink)" />
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    borderTop: '1px dashed var(--ink)',
                    paddingTop: 4,
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  toldproof · sealed
                </span>
              </div>
            </div>
            <div
              style={{
                position: 'absolute',
                left: '8%',
                bottom: '10%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 'clamp(10px, 1vw, 12px)',
                color: 'var(--ink-3)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ width: 8, height: 8, background: 'var(--ink-3)' }} /> SUI
              <span style={{ width: 8, height: 8, background: 'var(--ink-3)' }} /> WALRUS
              <span style={{ width: 8, height: 8, background: 'var(--ink-3)' }} /> SEAL
            </div>
          </div>
        </div>

        <div className="mt-48">
          <PageEyebrow>Color tokens</PageEyebrow>
          <div className="mt-16 grid-4" style={{ gap: 12 }}>
            <Swatch name="Ink" varName="--ink" hex="#14130f" />
            <Swatch name="Paper" varName="--paper" hex="#f6f4ef" />
            <Swatch name="Sealed (amber)" varName="--sealed" />
            <Swatch name="Verified (green)" varName="--verified" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LockupCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 22,
        background: 'var(--paper)',
        display: 'grid',
        gap: 14,
      }}
    >
      <span className="eyebrow">{label}</span>
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          padding: 28,
          background: 'var(--paper-2)',
          borderRadius: 4,
          minHeight: 200,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function GlyphCard({ label, mark }: { label: string; mark: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 22,
        background: 'var(--paper)',
        display: 'grid',
        gap: 10,
        placeItems: 'center',
      }}
    >
      <PixelMark bitmap={mark} size={64} color="var(--ink)" />
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Swatch({ name, varName, hex }: { name: string; varName: string; hex?: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <div style={{ background: `var(${varName})`, height: 80 }} />
      <div style={{ padding: '10px 12px' }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>
          {name}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
          {varName}
          {hex ? ` · ${hex}` : ''}
        </div>
      </div>
    </div>
  );
}
