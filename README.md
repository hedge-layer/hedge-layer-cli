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

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT
