// HumanNote — side card for the Humans lane. Describes the browser flow and
// the $1-per-lock price. Static content.

export function HumanNote() {
  return (
    <div className="af-side af-card-chrome">
      <div className="af-side-top">
        <span className="eyebrow">the human lane</span>
        <span className="af-chip af-chip-neutral">$1 / lock</span>
      </div>

      <p className="af-side-body">
        People seal straight from the browser: connect a Sui wallet, bind an X
        handle, encrypt locally, and pay $1 in USDC as they sign.
      </p>

      <div className="af-rows">
        <Row k="price" v="$1.00 / lock" strong />
        <Row k="paid in" v="USDC · wallet" />
        <Row k="identity" v="wallet ↔ X handle" />
      </div>

      <p className="af-callout">
        Same Move contract and the same $1 price as the agent path — the only
        difference is how you pay.
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
