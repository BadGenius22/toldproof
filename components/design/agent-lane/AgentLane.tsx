'use client';

// AgentLane — landing section that contrasts the two ways a prediction gets
// sealed: an AI agent over MCP + x402 (default), or a human in the browser.
// Owns the lane toggle; renders the animated terminal beside the matching
// side card. Sits right after "How it works" on the landing page.

import { useState } from 'react';
import { PageEyebrow } from '../Receipt';
import { AgentTerminal } from './AgentTerminal';
import { ToolCard } from './ToolCard';
import { HumanNote } from './HumanNote';
import type { Lane } from './lanes';

export function AgentLane() {
  const [lane, setLane] = useState<Lane>('agent');

  return (
    <div className="mt-48">
      <div className="af-head">
        <PageEyebrow>Same receipt · two front doors</PageEyebrow>
        <h2 className="section" style={{ maxWidth: 760 }}>
          An AI agent seals over{' '}
          <span className="mono" style={{ color: 'var(--sealed)' }}>
            MCP
          </span>
          , and pays per seal with{' '}
          <span className="mono" style={{ color: 'var(--sealed)' }}>
            x402
          </span>
          .
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Humans seal straight from the browser. Agents never touch the UI —
          they connect to our MCP endpoint and pay $0.10 in USDC over the x402
          protocol before the seal is written. Switch lanes to watch each
          round-trip.
        </p>

        <div className="af-toggle" aria-label="Choose a lane">
          <button
            type="button"
            className={lane === 'human' ? 'active' : ''}
            aria-pressed={lane === 'human'}
            onClick={() => setLane('human')}
          >
            Humans
          </button>
          <button
            type="button"
            className={lane === 'agent' ? 'active' : ''}
            aria-pressed={lane === 'agent'}
            onClick={() => setLane('agent')}
          >
            AI agents
          </button>
        </div>
      </div>

      <div className="af-grid mt-24">
        <AgentTerminal lane={lane} />
        {lane === 'agent' ? <ToolCard /> : <HumanNote />}
      </div>
    </div>
  );
}
