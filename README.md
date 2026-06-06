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

# 5. Run the persisted liquidity-provider loop
hl lp scan "liquidity opportunities"
hl lp recommend --scan-id <scan-id>
hl lp evaluate

# 6. Check linked wallet funds
hl wallet balances
```

## Commands

Full command documentation is available at
[hedgelayer.ai/docs/cli](https://hedgelayer.ai/docs/cli).

Liquidity-provider workflows are available under `hl lp`:

```bash
hl lp scan "liquidity opportunities"   # persist candidate evidence
hl lp recommend --scan-id <scan-id>    # recommend allocate/reduce/exit actions
hl lp evaluate                         # summarize PnL lessons
hl lp run                              # run the dry-run chain
```

Wallet commands are available under `hl wallet`:

```bash
hl wallet status                       # show linked owner and Polymarket deposit wallet status
hl wallet balances                     # show available pUSD, USDC.e, and POL
hl wallet funds                        # alias for balances
hl wallet deposit                      # show public Polygon deposit address and assets
hl wallet deposit --bridge             # also show Polymarket Bridge deposit addresses
hl wallet withdraw --asset pUSD --amount 10 --to 0x...
```

`hl wallet withdraw` creates a withdrawal intent, opens the browser signing page,
and polls until the deposit-wallet transfer succeeds, fails, or times out.
The CLI token never receives wallet signing power.

Withdrawals currently send `pUSD` from the linked Polymarket deposit wallet on Polygon.
Keep a small `POL` balance in the owner wallet for Polygon gas; without native
`POL`, the browser-signed transfer can fail even when the deposit wallet has
enough `pUSD`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT
