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

# 3. Start an interactive research session
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

### Research

AI-powered market research sessions. Describe a topic or thesis, and the AI researches current events, discovers relevant prediction markets, and synthesizes a structured Market Brief.

```bash
# Start an interactive research session
hl research

# List past research sessions
hl research list
hl research list --status completed

# View a specific session and its Market Brief
hl research show <id>

# Delete a session
hl research delete <id>
```

### Markets

Polymarket orderbook tools.

```bash
# View orderbook for a specific CLOB token
hl markets orderbook <tokenId>
hl markets orderbook <tokenId> --size 1000
```

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

## Development

```bash
git clone https://github.com/hedge-layer/hedge-layer-cli.git
cd hedge-layer-cli
npm install
npm run build        # Build with tsup
npm run dev          # Watch mode

# Test against local dev server
node dist/index.mjs --api-url http://localhost:3000 research list
```

## Publishing

Releases are automated via GitHub Actions. To publish a new version:

```bash
npm version patch    # or minor / major
git push --tags
```

The workflow builds and publishes to npm when a version tag (`v*`) is pushed. Authentication uses npm's OIDC trusted publishers — no secrets required.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT
