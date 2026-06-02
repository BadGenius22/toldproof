// ToolCard — side card for the AI agents lane. Describes the one paid MCP
// tool and how the x402 charge works. Static content.

export function ToolCard() {
  return (
    <div className="af-side af-card-chrome">
      <div className="af-side-top">
        <span className="eyebrow">the paid tool</span>
        <span className="af-chip">x402</span>
      </div>

      <span className="af-pill">seal_prediction</span>

      <p className="af-side-body">
        One of five tools — the only paid one. Charges before it writes to Sui;
        the other four (read, list, leaderboard, verify) stay free.
      </p>

      <div className="af-rows">
        <Row k="price" v="$1.00 USDC" strong />
        <Row k="rail" v="x402 · HTTP 402" />
        <Row k="chain" v="Base" />
        <Row k="onramp" v="none — no key, no signup" />
      </div>

      <p className="af-callout">
        The agent pays in-band: it gets a <strong>402</strong>, settles USDC,
        and retries the same call. No human in the loop.
      </p>
    </div>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="af-row">
      <span className="af-row-k">{k}</span>
      <span className={`af-row-v${strong ? ' strong' : ''}`}>{v}</span>
    </div>
  );
}
