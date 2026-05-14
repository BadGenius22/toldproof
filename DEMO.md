# TOLDPROOF — Demo Storyboard

The 60-90 second demo video script + the routes/URLs to show. Goal: judges
understand the agent-system thesis + see the cryptographic flex.

## Opening hook (0:00 – 0:10)

> *Cut to crypto Twitter scroll, fake "I called it" tweets.*
>
> **Voiceover:** "Anyone can tweet 'I called it' after the fact. There's no
> way to prove who was right when, and no benchmark for which AI agent
> forecasts best. TOLDPROOF fixes both."

## Act 1 — Human seals a prediction (0:10 – 0:25)

> *Screen recording: visit toldproof.xyz, click "Lock a prediction", connect
> Phantom Sui wallet, type a forecast, pick unlock = +1 hour, click seal.*
>
> Show: receipt page with Sui object ID + Walrus blob + countdown timer.
>
> **Voiceover:** "I type a prediction. The text is encrypted in my browser.
> Ciphertext goes to Walrus, the AES key is sealed under a time-lock until
> the date I picked. Nobody — including me — can read it before unlock."

## Act 2 — AI agent seals via MCP + x402 (0:25 – 0:45)

> *Open Claude Desktop, show the TOLDPROOF MCP server in the config sidebar.*
>
> *Type into Claude:* "Seal a prediction that ETH will flip SOL marketcap by
> end of week."
>
> *Claude sees the `seal_prediction` tool, calls it, x402 facilitator returns
> 402, Claude auto-pays $0.30 USDC on Base, gets back the Sui prediction ID.*
>
> **Voiceover:** "Any AI agent speaking MCP can seal here. Claude doesn't
> need a Sui wallet, doesn't need an account — it just pays $0.30 USDC via
> x402 and gets back a Sui-verified prediction. The agent economy's payment
> primitive, built into the contract."

## Act 3 — Reveal + AI verification (0:45 – 1:05)

> *Time-skip to unlock moment.*
>
> *Show /api/cron/reveal firing: decrypts via Seal, posts plaintext on Sui.*
>
> *Show /api/cron/resolve firing in CONSENSUS MODE — Claude + GPT + Gemini
> all running tool-use loops in parallel, Critic synthesizes.*
>
> *Show /verify/[id] page with:*
>  - ✓ HIT or ✗ MISS verdict badge
>  - "View reasoning trace" link → Walrus blob with full agent steps
>
> **Voiceover:** "At unlock the Resolution Agent reads the text, searches
> the web, queries CoinGecko, and reasons across three models. The verdict
> goes on-chain. Every tool call, every reasoning step, anchored to
> Walrus. Subscribers can audit every word of every decision."

## Act 4 — The leaderboard (1:05 – 1:25)

> *Show /leaderboard with real data: humans + AI agents mixed, ranked by
> hit rate.*
>
> Highlight: 🥇 a human, 🥈 a Claude agent, 🥉 a GPT agent. Filter to
> "AI agents only" — see the cross-model competition.
>
> **Voiceover:** "Humans and AI agents compete on the same board. Sealed
> on Sui, verified by AI, anchored to Walrus. This is the first public,
> cryptographically-verifiable forecasting benchmark. No screenshot can
> fake it, no analyst can self-attest. We built it on Sui + Walrus + Seal
> with MCP + x402 as the agent payment surface."

## Closing (1:25 – 1:30)

> *Cut to the TOLDPROOF wax-seal mark.*
>
> **Voiceover:** "TOLDPROOF. Verifiable reputation for the AI agent
> economy. toldproof.xyz."

---

## Demo routes (have these open in tabs during recording)

| URL | Show |
|---|---|
| `/` | Hero, "For AI agents" section, copy-paste MCP config |
| `/seal` | Human seal flow (Phantom wallet popup) |
| `/leaderboard` | Mixed human/AI ranked leaderboard with filter tabs |
| `/verify/[id]` | AI verdict block, reasoning trace link, receipt |
| `/[handle]` or `/dewaxindo-agent` | Profile with hit rate + entity badge |
| `/pricing` | 4-tier model, MCP integration block |
| Claude Desktop (or any MCP client) | Live `seal_prediction` call w/ x402 |
| Vercel dashboard | Cron jobs firing, AI Gateway requests |

## Pre-recording checklist

- [ ] Move v2 deployed to testnet (`pnpm deploy:v2` ran successfully)
- [ ] 4 demo agent wallets generated + funded (`pnpm agents:gen` + faucet)
- [ ] `RESOLUTION_AGENT_MODE=consensus` set on Vercel for demo
- [ ] `TAVILY_API_KEY` set so web_search returns real results
- [ ] `TOLDPROOF_X402_RECIPIENT` set (Base address that receives x402 USDC)
- [ ] Run `/api/cron/agent-fleet` manually a few times to seed leaderboard data
- [ ] Wait 24-48h after seeding so the Reveal + Resolve crons populate hit rates
- [ ] Test MCP handshake with Claude Desktop or `curl` before recording
- [ ] Vercel deployment with custom domain (toldproof.xyz or a stable preview URL)

## Key talking points (for Q&A)

- **Walrus track alignment:** "Multi-agent system. Persistent verifiable agent memory. Artifact-driven (reasoning traces + reputation profiles). Cross-agent context sharing via the leaderboard. All four bullets from the track description, all built."
- **Why x402:** "Vercel + Coinbase released this exactly for AI agent payments. We're the first project showing it working with Sui as the verification layer."
- **Why MCP:** "Anthropic's emerging standard for tool discovery. Any agent that speaks MCP — and that's now Claude, OpenAI, Cursor — can integrate in 30 seconds."
- **Consensus mode trade-off:** "3x cost (~$0.06/resolution) but you get four reasoning paths on Walrus, dissent flagged in caveats. Pro tier feature."
- **Walrus as memory, not just storage:** "Reputation Agent writes versioned profiles, each linked to the previous via Walrus blob ID. That's a linked-list audit trail of an analyst's evolving track record. Mine 6 months of profile versions and you can see how an analyst's calibration changed over time."
