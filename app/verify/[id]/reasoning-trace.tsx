'use client';

import { useState } from 'react';

// In-receipt timeline of how the AI judged this prediction. Default collapsed
// so the page stays scannable; expand reveals every tool call + the AI's text
// rendered in plain English. The raw Walrus JSON link is kept as a footer for
// power users / auditors who want the unprocessed trace.
//
// Trace shape mirrors lib/resolve.ts ReasoningTrace, but only the bits we
// actually render are typed here — the trace JSON may be the synthesizer's
// consensus-mode shape OR the single-model shape, so we accept both.

type DifficultyLevel = 'trivial' | 'easy' | 'medium' | 'hard';

interface SingleAgentRecord {
  model: string;
  steps: Array<{
    stepIndex: number;
    text: string;
    toolCalls: Array<{
      tool: string;
      input: unknown;
      output: unknown;
    }>;
  }>;
  totalSteps?: number;
  tokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  verdict?: VerdictShape;
}

interface VerdictShape {
  hit: boolean;
  confidence: number;
  reasoning: string;
  sources: string[];
  caveats?: string;
  difficulty?: DifficultyLevel;
  difficultyReasoning?: string;
}

export interface Trace {
  version?: number;
  mode?: 'single' | 'consensus';
  verdict: VerdictShape;
  singleAgent?: SingleAgentRecord;
  workers?: SingleAgentRecord[];
  criticReasoning?: string;
  totalTokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

interface Props {
  trace: Trace;
  rawWalrusUrl: string;
}

export function ReasoningTrace({ trace, rawWalrusUrl }: Props) {
  const [open, setOpen] = useState(false);

  const verdict = trace.verdict;
  const isConsensus = trace.mode === 'consensus';
  const workers: SingleAgentRecord[] = isConsensus
    ? trace.workers ?? []
    : trace.singleAgent
      ? [trace.singleAgent]
      : [];

  const totalSteps = workers.reduce(
    (acc, w) => acc + (w.totalSteps ?? w.steps?.length ?? 0),
    0,
  );

  return (
    <div className="col" style={{ gap: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn ghost"
        aria-expanded={open}
        style={{ alignSelf: 'flex-start' }}
      >
        {open ? '↑ Hide how the AI decided' : '↓ See how the AI decided'}
      </button>

      {open && (
        <div
          style={{
            border: '1px solid var(--border)',
            background: 'var(--paper-2)',
            borderRadius: 4,
            padding: '14px 16px',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--ink-2)',
          }}
        >
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span className="eyebrow">
              {isConsensus ? (
                <>
                  {workers.length} AI judges read this together{' '}
                  <span style={{ color: 'var(--muted)' }}>(panel mode)</span>
                </>
              ) : (
                <>
                  Judged by: {friendlyModelName(workers[0]?.model)}{' '}
                  <span style={{ color: 'var(--muted)' }}>(quick mode)</span>
                </>
              )}
            </span>
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--muted)' }}
            >
              {totalSteps} step{totalSteps === 1 ? '' : 's'} ·{' '}
              {(verdict.confidence * 100).toFixed(0)}% sure
            </span>
          </div>

          {verdict.difficulty && (
            <div
              style={{
                marginBottom: 14,
                paddingBottom: 12,
                borderBottom: '1px dashed var(--border)',
              }}
            >
              <span className="eyebrow">How surprising was this call?</span>
              <p style={{ margin: '6px 0 0', color: 'var(--ink)' }}>
                <strong>{difficultyLabel(verdict.difficulty)}</strong>
                {verdict.difficultyReasoning ? ' — ' + verdict.difficultyReasoning : ''}
              </p>
            </div>
          )}

          {workers.map((worker, wi) => (
            <div
              key={wi}
              style={{
                marginBottom: wi < workers.length - 1 ? 16 : 0,
                paddingBottom: wi < workers.length - 1 ? 14 : 0,
                borderBottom:
                  wi < workers.length - 1 ? '1px dashed var(--border)' : 'none',
              }}
            >
              {isConsensus && (
                <p
                  className="eyebrow"
                  style={{ marginBottom: 8, color: 'var(--ink)' }}
                >
                  {friendlyModelName(worker.model)}
                </p>
              )}
              <Timeline steps={worker.steps ?? []} />
            </div>
          ))}

          {isConsensus && trace.criticReasoning && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px dashed var(--border)',
              }}
            >
              <span className="eyebrow">How the judges agreed</span>
              <p style={{ margin: '6px 0 0' }}>{trace.criticReasoning}</p>
            </div>
          )}

          {verdict.sources?.length > 0 && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px dashed var(--border)',
              }}
            >
              <span className="eyebrow">What the AI checked</span>
              <ul
                style={{
                  margin: '6px 0 0',
                  paddingLeft: 18,
                  fontSize: 12,
                  color: 'var(--ink-2)',
                }}
              >
                {verdict.sources.map((src, i) => (
                  <li key={i} style={{ fontFamily: 'var(--font-mono), monospace' }}>
                    {renderSource(src)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px dashed var(--border)',
              fontSize: 11,
              color: 'var(--muted)',
            }}
          >
            Power user? Open the{' '}
            <a href={rawWalrusUrl} target="_blank" rel="noreferrer">
              raw record on Walrus ↗
            </a>{' '}
            for the unprocessed JSON.
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({
  steps,
}: {
  steps: SingleAgentRecord['steps'];
}) {
  if (steps.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--muted)' }}>
        No steps recorded.
      </p>
    );
  }
  return (
    <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
      {steps.map((step, i) => (
        <li
          key={i}
          style={{
            marginBottom: i < steps.length - 1 ? 12 : 0,
            paddingLeft: 14,
            borderLeft: '2px solid var(--border)',
          }}
        >
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--ink)' }}>
            Step {i + 1}
            {summariseStep(step) ? ' — ' + summariseStep(step) : ''}
          </p>
          {step.text && (
            <p style={{ margin: '0 0 6px', color: 'var(--ink-2)' }}>
              <em>“{truncate(step.text, 320)}”</em>
            </p>
          )}
          {step.toolCalls.map((call, j) => (
            <ToolCallCard key={j} call={call} />
          ))}
        </li>
      ))}
    </ol>
  );
}

function ToolCallCard({
  call,
}: {
  call: SingleAgentRecord['steps'][number]['toolCalls'][number];
}) {
  const label = toolLabel(call.tool);
  const inputSummary = summariseInput(call.tool, call.input);
  const outputSummary = summariseOutput(call.tool, call.output);

  return (
    <div
      style={{
        margin: '4px 0',
        padding: '6px 10px',
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        fontSize: 11,
        fontFamily: 'var(--font-mono), monospace',
        color: 'var(--ink-2)',
      }}
    >
      <span style={{ color: 'var(--ink)' }}>{label}</span>
      {inputSummary && (
        <span style={{ color: 'var(--muted)' }}> · {inputSummary}</span>
      )}
      {outputSummary && (
        <div style={{ marginTop: 2, color: 'var(--ink-2)' }}>
          ↳ {outputSummary}
        </div>
      )}
    </div>
  );
}

// ─── Plain-English mappers ─────────────────────────────────────────────

function friendlyModelName(model: string | undefined): string {
  if (!model) return 'an AI';
  if (model.includes('claude')) return 'Claude (Sonnet 4.5)';
  if (model.includes('gpt')) return 'GPT-5';
  if (model.includes('gemini')) return 'Gemini 2.5 Pro';
  return model;
}

function difficultyLabel(d: DifficultyLevel): string {
  switch (d) {
    case 'trivial':
      return 'Already true when locked';
    case 'easy':
      return 'Likely outcome';
    case 'medium':
      return 'Real call';
    case 'hard':
      return 'Bold call';
  }
}

function toolLabel(tool: string): string {
  switch (tool) {
    case 'get_token_price':
      return 'Looked up a token price';
    case 'get_price_history':
      return 'Pulled price history';
    case 'web_search':
      return 'Searched the web';
    case 'submit_verdict':
      return 'Made the final call';
    default:
      return tool;
  }
}

function summariseStep(
  step: SingleAgentRecord['steps'][number],
): string {
  // Try to name the step by what tool got called.
  const firstTool = step.toolCalls[0]?.tool;
  if (!firstTool) return '';
  switch (firstTool) {
    case 'get_token_price':
      return 'Looked up the current price';
    case 'get_price_history':
      return 'Pulled price history';
    case 'web_search':
      return 'Searched the web';
    case 'submit_verdict':
      return 'Made the call';
    default:
      return '';
  }
}

function summariseInput(tool: string, input: unknown): string {
  if (!isObj(input)) return '';
  switch (tool) {
    case 'get_token_price':
    case 'get_price_history':
      return String(input.symbolOrId ?? '');
    case 'web_search':
      return `"${String(input.query ?? '')}"`;
    case 'submit_verdict': {
      const v = input as { hit?: boolean; confidence?: number };
      if (typeof v.hit === 'boolean' && typeof v.confidence === 'number') {
        return `${v.hit ? 'Hit' : 'Miss'} · ${Math.round(v.confidence * 100)}% sure`;
      }
      return '';
    }
    default:
      return '';
  }
}

function summariseOutput(tool: string, output: unknown): string {
  if (!isObj(output)) return '';
  switch (tool) {
    case 'get_token_price': {
      const o = output as { ok?: boolean; symbol?: string; priceUsd?: number; change24hPct?: number };
      if (!o.ok || typeof o.priceUsd !== 'number') return '';
      const chg =
        typeof o.change24hPct === 'number'
          ? ` (${o.change24hPct >= 0 ? '+' : ''}${o.change24hPct.toFixed(2)}% 24h)`
          : '';
      return `${o.symbol ?? ''} = $${o.priceUsd.toLocaleString('en-US')}${chg}`;
    }
    case 'get_price_history': {
      const o = output as {
        ok?: boolean;
        symbol?: string;
        days?: number;
        high?: number;
        low?: number;
      };
      if (!o.ok) return '';
      const range =
        typeof o.high === 'number' && typeof o.low === 'number'
          ? ` · range $${o.low.toFixed(0)} → $${o.high.toFixed(0)}`
          : '';
      return `${o.symbol ?? ''} over ${o.days ?? '?'}d${range}`;
    }
    case 'web_search': {
      const o = output as { ok?: boolean; results?: unknown[]; error?: string };
      if (o.ok && Array.isArray(o.results)) return `${o.results.length} results`;
      if (o.error) return o.error.slice(0, 80);
      return '';
    }
    case 'submit_verdict':
      return '';
    default:
      return '';
  }
}

function renderSource(src: string): React.ReactNode {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return (
      <a href={src} target="_blank" rel="noreferrer">
        {src}
      </a>
    );
  }
  return src;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
