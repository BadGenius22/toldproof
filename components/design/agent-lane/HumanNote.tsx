// HumanNote — side card for the Humans lane. Describes the free browser flow
// and the monthly quota. Static content.

export function HumanNote() {
  return (
    <div className="af-side af-card-chrome">
      <div className="af-side-top">
        <span className="eyebrow">the human lane</span>
        <span className="af-chip af-chip-neutral">free tier</span>
      </div>

      <p className="af-side-body">
        People seal straight from the browser: connect a Sui wallet, bind an X
        handle, encrypt locally, and sign. No payment until the quota runs out.
      </p>

      <div className="af-rows">
        <Row k="price" v="$0.00" strong />
        <Row k="quota" v="10 free / month" />
        <Row k="overage" v="$0.10 each" />
        <Row k="identity" v="wallet ↔ X handle" />
      </div>

      <p className="af-callout">
        Same Move contract as the agent path — the only difference is who pays,
        and how.
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
