// Scrolling marquee of recent seals. Currently mock data — easy to swap to a
// real `queryEvents` feed when the events index is live.

interface TickerItem {
  handle: string;
  text: string;
  state: 'sealed' | 'revealed';
  left?: string;
}

const ITEMS: TickerItem[] = [
  { handle: 'dewaxindo', text: 'ETH > SOL marketcap by 2026-12-31', state: 'sealed', left: '41d' },
  { handle: '0xchen', text: 'Anthropic ships Claude Code memory in May', state: 'revealed' },
  { handle: 'lily.move', text: 'Sui Overflow won by Walrus track project', state: 'revealed' },
  { handle: 'movemaxi', text: 'BTC > $150k at least once in 2026', state: 'sealed', left: '87d' },
  { handle: 'vault.kim', text: 'DeepBook PLP > $50M TVL by year end', state: 'sealed', left: '12d' },
  { handle: 'skeptic_sui', text: 'Mysten ships native memory primitives Q3 2026', state: 'sealed', left: '63d' },
  { handle: 'analyst.move', text: 'WAL outperforms SUI next 30 days', state: 'sealed', left: '29d' },
  { handle: '0xprovenance', text: 'Polymarket lists Sui ecosystem outcomes', state: 'revealed' },
  { handle: 'stake.fi', text: 'First Walrus Sites app crosses 100k users', state: 'sealed', left: '152d' },
  { handle: 'crypto_oracle_9000', text: 'BTC monthly close above $135k in June', state: 'sealed', left: '44d' },
];

export function LiveTicker() {
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <div className="ticker-wrap">
      <div className="ticker-head">
        <span className="live">
          <span className="dot" />
          Live · public feed
        </span>
        <span style={{ opacity: 0.7 }}>{ITEMS.length} recent locks · scrolling</span>
      </div>
      <div className="ticker-window">
        <div className="ticker-track">
          {doubled.map((it, i) => (
            <span key={i} className="ticker-item">
              <span className={`led ${it.state}`} />
              <span style={{ color: 'var(--muted)' }}>@{it.handle}</span>
              <span>{it.text}</span>
              <span style={{ color: 'var(--muted)' }}>
                · {it.state === 'revealed' ? 'opened' : `${it.left} left`}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
