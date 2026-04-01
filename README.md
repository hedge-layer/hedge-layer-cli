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

# Disable streaming (block until complete)
hl brief "AI regulation in Europe" --no-stream
```

| Option | Description |
|--------|-------------|
| `-l, --location <loc>` | Geographic context (e.g. `"Middle East"`, `"US"`) |
| `-t, --time-horizon <h>` | Time frame (e.g. `"3 months"`, `"2026"`) |
| `--tags <tags>` | Comma-separated focus area tags (e.g. `"geopolitics,energy"`) |
| `--min-volume <n>` | Minimum market volume in USD |
| `--max-yes-price <n>` | Maximum YES price (0-1) |
| `--no-stream` | Disable streaming — block until complete |

### Research

AI-powered interactive research sessions. Describe a topic or thesis, and the AI researches current events, discovers relevant prediction markets, and synthesizes a structured Market Brief through a multi-turn conversation.

```bash
# Start an interactive research session (Q&A)
hl research

# List past research sessions
hl research list
hl research list --status completed

# View a specific session and its Market Brief
hl research show <id>

# Delete a session
hl research delete <id>
```

For non-interactive, single-shot brief generation, use `hl brief` — it uses a dedicated API endpoint optimized for programmatic use.

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
