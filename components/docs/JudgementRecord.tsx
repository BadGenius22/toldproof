'use client';

// JudgementRecord — monospace "ledger" of a worked AI Resolution Agent run.
// Used on /docs/resolution to make the abstract tool-use loop concrete.
// Mock fixture for v1; real verdicts can swap in later by passing props.

import { useState } from 'react';

interface ToolCall {
  tMs: number;
  tool: 'Tavily' | 'CoinGecko';
  query: string;
  response: string;
}

interface ModelVerdict {
  model: string;
  verdict: 'HIT' | 'MISS' | "CAN'T TELL";
  confidence: number;
}

const FIXTURE: {
  prediction: string;
  toolCalls: ToolCall[];
  modelVerdicts: ModelVerdict[];
  criticVerdict: string;
  finalVerdict: string;
  reasoningNotes: string;
} = {
  prediction: '"BTC closes above $100k by 2026-12-31"',
  toolCalls: [
    {
      tMs: 400,
      tool: 'CoinGecko',
      query: 'bitcoin/usd · 2026-12-31',
      response: '{ "price": 108402.17, "date": "2026-12-31T23:59:59Z" }',
    },
    {
      tMs: 1200,
      tool: 'Tavily',
      query: '"BTC year-end close 2026"',
      response:
        '3 results: CoinDesk, The Block, Bloomberg — all report BTC closed at $108.4k on Dec 31 2026.',
    },
    {
      tMs: 2100,
      tool: 'Tavily',
      query: '"December 31 2026 BTC price"',
      response:
        '5 results: Reuters confirms $108,402 close at 23:59:59 UTC. CME settled at $108,397.',
    },
  ],
  modelVerdicts: [
    { model: 'Claude', verdict: 'HIT', confidence: 0.97 },
    { model: 'GPT', verdict: 'HIT', confidence: 0.94 },
    { model: 'Gemini', verdict: 'HIT', confidence: 0.96 },
  ],
  criticVerdict: 'PASS · 3-of-3 agree, sources independent, no dissent',
  finalVerdict: 'HIT · BTC closed at $108,402 on 2026-12-31 (UTC)',
  reasoningNotes: 'walrus://u8kQ…tw',
};

export function JudgementRecord() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div
      className="docs-judgement"
      style={{
        border: '1px solid var(--ink)',
        borderRadius: 4,
        background: 'var(--paper)',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 12.5,
        lineHeight: 1.6,
        overflow: 'hidden',
        marginTop: 16,
      }}
    >
      <Section label="Prediction">
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {FIXTURE.prediction}
        </span>
      </Section>

      <Section label="Lookups">
        <div style={{ display: 'grid', gap: 6 }}>
          {FIXTURE.toolCalls.map((c, i) => {
            const isOpen = expanded === i;
            return (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : i)}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '64px 88px 1fr 14px',
                    gap: 12,
                    alignItems: 'baseline',
                    background: 'transparent',
                    border: 'none',
                    padding: '2px 0',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  aria-expanded={isOpen}
                >
                  <span style={{ color: 'var(--muted)' }}>
                    +{(c.tMs / 1000).toFixed(1)}s
                  </span>
                  <span style={{ color: 'var(--sealed-text)' }}>{c.tool}</span>
                  <span style={{ color: 'var(--ink-2)' }}>{c.query}</span>
                  <span
                    style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(90deg)' : 'none' }}
                  >
                    ›
                  </span>
                </button>
                {isOpen ? (
                  <div
                    style={{
                      marginTop: 4,
                      marginLeft: 76,
                      padding: '8px 10px',
                      borderLeft: '2px solid var(--border)',
                      color: 'var(--ink-3)',
                      fontSize: 11.5,
                      lineHeight: 1.55,
                      background: 'var(--paper-2)',
                      borderRadius: '0 3px 3px 0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {c.response}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>

      <Section label="Consensus">
        <div style={{ display: 'grid', gap: 4 }}>
          {FIXTURE.modelVerdicts.map((m) => (
            <div
              key={m.model}
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 90px 1fr',
                gap: 12,
                alignItems: 'baseline',
              }}
            >
              <span style={{ color: 'var(--ink-2)' }}>{m.model}</span>
              <span
                style={{
                  color: 'var(--verified-text)',
                  fontWeight: 600,
                }}
              >
                {m.verdict}
              </span>
              <span style={{ color: 'var(--muted)' }}>
                · {m.confidence.toFixed(2)} confidence
              </span>
            </div>
          ))}
          <div
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTop: '1px dashed var(--border)',
              display: 'grid',
              gridTemplateColumns: '90px 1fr',
              gap: 12,
            }}
          >
            <span style={{ color: 'var(--ink-2)' }}>Critic</span>
            <span style={{ color: 'var(--ink-3)' }}>{FIXTURE.criticVerdict}</span>
          </div>
        </div>
      </Section>

      <Section label="Verdict" emphasis>
        <div style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {FIXTURE.finalVerdict}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 4 }}>
          Reasoning notes saved on Walrus: {FIXTURE.reasoningNotes}
        </div>
      </Section>
    </div>
  );
}

function Section({
  label,
  emphasis = false,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        padding: '14px 16px',
        background: emphasis ? 'var(--sealed-soft)' : 'transparent',
      }}
    >
      <div
        className="eyebrow"
        style={{ marginBottom: 6, color: emphasis ? 'var(--sealed-text)' : 'var(--muted)' }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
