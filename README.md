# @hedge-layer/cli

[![npm version](https://img.shields.io/npm/v/@hedge-layer/cli)](https://www.npmjs.com/package/@hedge-layer/cli)
[![license](https://img.shields.io/github/license/hedge-layer/hedge-layer-cli)](LICENSE)

Command-line interface for [Hedge Layer](https://hedgelayer.ai) — prediction market intelligence from the terminal.

## Install

```bash
npm install -g @hedge-layer/cli
```

Requires Node.js 22 or later.

## Quick Start

```bash
# 1. Create an API token at https://hedgelayer.ai/settings → API Tokens
# 2. Authenticate the CLI
hl auth login

# 3. Generate a Market Brief
hl brief "US China trade war tariffs"

# 4. Or start an interactive research session
hl research
```

## Authentication

The CLI uses API tokens created in the Hedge Layer web app. Tokens are stored locally in `~/.hedgelayer/config.json`.

```bash
hl auth login      # Paste your API token (interactive)
hl auth status     # Check current authentication
hl auth logout     # Remove stored token
```

You can also pass a token inline for CI/scripts:

```bash
hl --token hl_abc123... research list
```

## Commands

### Brief

Generate a Market Brief directly from a topic — no Q&A, no interactive session. The AI researches current events, discovers relevant prediction markets, and synthesizes a structured brief with causal reasoning and coverage gaps.

```bash
# Generate a brief (streams progress to stderr, brief to stdout)
hl brief "US China trade war tariffs"
hl brief "hurricane season impact on Florida" --location "US Southeast" --time-horizon "6 months"

# Pipe the brief as JSON
hl --json brief "crypto regulation 2026" | jq '.markets'

# Filter by tags and volume
hl brief "energy policy" --tags "geopolitics,energy" --min-volume 10000
```

| Option | Description |
|--------|-------------|
| `-l, --location <loc>` | Geographic context (e.g. `"Middle East"`, `"US"`) |
| `-t, --time-horizon <h>` | Time frame (e.g. `"3 months"`, `"2026"`) |
| `--tags <tags>` | Comma-separated focus area tags (e.g. `"geopolitics,energy"`) |
| `--min-volume <n>` | Minimum market volume in USD |
| `--max-yes-price <n>` | Maximum YES price (0-1) |

### Research

AI-powered interactive research sessions. Describe a topic or thesis, and the AI researches current events, discovers relevant prediction markets, and synthesizes a structured Market Brief through a multi-turn conversation.

```bash
# Start an interactive research session (Q&A)
hl research

# Non-interactive: same Market Brief as `hl brief`, JSON on stdout (blocking `POST /api/brief` with stream off)
hl research run "US election forecasting"

# List past research sessions
hl research list
hl research list --status completed

# View a specific session and its Market Brief
hl research show <id>

# Delete a session
hl research delete <id>
```

For a **non-interactive** JSON brief from the shell, use `hl research run` (blocking) or `hl brief` (streams progress on stderr). Both use the same `POST /api/brief` endpoint.

### Feed

Deterministic ranking of active Polymarket markets (same engine as the in-app **getFeed** tool and `GET /api/feed`). No LLM — fast quantitative screens.

```bash
# LP-style screen: thinner books with meaningful daily rewards (reward yield ranking)
hl feed lp-opportunity
hl --json feed lp-opportunity | jq '.markets[:5]'

# Deep books that are either new (last 7d) or long-dated (90d+ to resolution), sorted by liquidity
hl feed liquid-new-or-long

# Custom: e.g. crypto tag only, sort by movement
hl feed --tag crypto --sort-by movement --limit 25

# Candidate screen tuned for allocator dry-run cycles
hl feed liquidity-provider
```

Curated defaults live in the API (`profile=lp-opportunity`, `profile=liquidity-provider`, and `profile=liquid-new-or-long`); CLI flags override those defaults. Use `hl feed --help` for every filter.

### Allocator

Run the liquidity-provider loop from the terminal. The CLI first fetches feed candidates, then calls `POST /api/allocator/cycle` with your API token. The web API enforces user-scoped auth and dry-run mode; this command plans allocations and passive orders but does not place live trades.

```bash
# Run a dry-run LP allocation cycle from the default lp-opportunity feed
hl allocator cycle

# Use the allocator-focused feed profile and repeat once with returned targets
hl allocator cycle liquidity-provider --repeat --max-markets 5

# Pipe machine-readable decisions into jq
hl --json allocator cycle --capital-limit 1000 --per-market-limit 150 | jq '.result.summary'

# Continue a monitoring/rebalance cycle from existing allocation state
hl allocator cycle --allocations ./allocations.json
```

Key options include `--capital-limit`, `--per-market-limit`, `--min-expected-return-daily-pct`, `--max-order-notional`, `--max-spread`, `--allocator-min-liquidity`, and the same feed filters used by `hl feed`.

### Profile

```bash
hl profile
```

## Global Options

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable JSON output |
| `--api-url <url>` | Override API base URL (default: `https://hedgelayer.ai`) |
| `--token <token>` | Override stored API token |
| `--verbose` | Show HTTP request/response details |
| `--no-color` | Disable colored output |

### JSON output

Every command supports `--json` for pipe-friendly output:

```bash
hl --json research list | jq '.[0].id'
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT
