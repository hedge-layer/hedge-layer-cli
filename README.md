# @hedge-layer/cli

[![npm version](https://img.shields.io/npm/v/@hedge-layer/cli)](https://www.npmjs.com/package/@hedge-layer/cli)
[![license](https://img.shields.io/github/license/hedge-layer/hedge-layer-cli)](LICENSE)

Command-line interface for [Hedge Layer](https://hedgelayer.ai): prediction market intelligence from the terminal.

The canonical CLI guide now lives in the Hedge Layer web app docs:
[hedgelayer.ai/docs/cli](https://hedgelayer.ai/docs/cli).

## Install

```bash
npm install -g @hedge-layer/cli
```

Requires Node.js 22 or later.

### Install troubleshooting

- **`EACCES` / "operation was rejected by your operating system"** on `npm install -g`:
  your npm prefix points at a root-owned directory (e.g. `/usr/lib/node_modules`) and you
  don't have `sudo`. Install into a user-writable prefix instead:

  ```bash
  mkdir -p "$HOME/.npm-global"
  npm config set prefix "$HOME/.npm-global"
  export PATH="$HOME/.npm-global/bin:$PATH"   # add to your shell rc to persist
  npm install -g @hedge-layer/cli
  ```

- **`nvm` warns `npmrc ... globalconfig and/or prefix setting ... incompatible with nvm`:**
  this is harmless shell-init noise from `nvm` (not from `hl`) that appears after setting a
  custom npm prefix as above — the CLI still works. To avoid it entirely under `nvm`, install
  without a custom prefix (nvm's per-version `bin/` is already user-writable):

  ```bash
  npm config delete prefix
  npm config delete globalconfig
  nvm use --delete-prefix "$(node -v)" --silent
  npm install -g @hedge-layer/cli
  ```

  Alternatively, skip the global install and run on demand with `npx @hedge-layer/cli <command>`.

## Quick Start

```bash
# 1. Create an API token at https://hedgelayer.ai/account/settings
# 2. Authenticate the CLI
hl auth login

# 3. Generate a Market Brief
hl brief "US China trade war tariffs"

# 4. Or start an interactive research session
hl research

# 5. Preview a directional quote (analysis only; no order is submitted)
hl quote "example-market" --action buy --outcome yes --cash 25

# 6. Save a fresh quote preview with Signal-linked sizing context
hl quote "example-market" --action buy --outcome yes --cash 25 \
  --signal-id <forecast-id> --capital 1000 --save

# 7. Run the advanced dry-run liquidity-provider planner
hl --json feed liquidity-provider --limit 15 | jq '{ markets: .markets }' > markets.json
hl lp allocator --markets markets.json
your execution workflow

# 8. Analyze a market probability edge
hl signal analyze "https://polymarket.com/event/example-market"
```

## Commands

Full command documentation is available at
[hedgelayer.ai/docs/cli](https://hedgelayer.ai/docs/cli).

Directional quote previews are available with `hl quote`:

```bash
hl quote example-market --action buy --outcome yes --cash 25
hl quote example-market --action buy --outcome no --shares 50 --route passive
hl quote example-market --action sell --outcome yes --shares 20 --save
hl --json quote example-market --action buy --outcome yes --cash 25
```

Quote reads public Polymarket market data and order-book depth, then reports the
estimated fill, slippage, fees, cost or proceeds, payout risk, and optional
Signal edge. It never signs or submits an order. `--cash` is BUY-only; SELL
quotes require `--shares`.

Advanced liquidity-provider planning remains available under `hl lp` as a
dry-run-only API client:

```bash
hl lp allocator --markets markets.json
```

The lightweight LP planning loop is:

```bash
hl feed ensemble --limit 25 --output candidates.json
# or: hl --json feed lp-opportunity --limit 15 > markets.json
external-pnl-export --json > pnl.json   # optional: wallet PnL + live inventory
hl lp allocator --markets candidates.json --pnl pnl.json --allocations pnl.json
your execution workflow ...
```

`hl feed ensemble` runs several feed lenses (liquid core, active volume, movers, new markets, uncertainty, and LP quality), de-duplicates by slug, and writes a daily candidate file.

`hl lp allocator` submits the candidate market list through the web API to the
allocator agent. Allocator output shows target capital, quote regime, failed
safety checks, and split spread/reward economics. Trade execution stays outside
the `hl` CLI.

`--allocations` tells the allocator what you already hold (enabling HOLD,
REDUCE, and EXIT decisions), and `--pnl` feeds per-market PnL into its caution
overlay so borderline allocations on losing markets are downgraded to WATCH or
HOLD. Both flags accept the same external wallet/inventory export shape.

Signal-agent analysis is available under `hl signal`:

```bash
hl signal analyze "https://polymarket.com/event/example-market"
hl signal analyze "https://polymarket.com/event/example-market" --context "Recent search notes"
hl --json signal analyze "https://polymarket.com/event/example-market" | jq '.result.analysis'
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT
