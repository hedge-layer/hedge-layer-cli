# @hedgelayer/cli

[![npm version](https://img.shields.io/npm/v/@hedgelayer/cli)](https://www.npmjs.com/package/@hedgelayer/cli)
[![license](https://img.shields.io/github/license/hedgelayer/cli)](LICENSE)

Command-line interface for [Hedge Layer](https://hedgelayer.ai) — hedge real-world risks on Polymarket prediction markets.

## Install

```bash
npm install -g @hedgelayer/cli
```

Requires Node.js 22 or later.

## Quick Start

```bash
# 1. Create an API token at https://hedgelayer.ai/settings → API Tokens
# 2. Authenticate the CLI
hl auth login

# 3. Search prediction markets
hl markets search "hurricane"

# 4. Start an interactive risk assessment
hl assess
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
hl --token hl_abc123... markets search "earthquake"
```

## Commands

### Markets

Browse Polymarket prediction markets (no authentication required).

```bash
# Search markets by keyword
hl markets search "wildfire"
hl markets search "hurricane" --limit 20

# View orderbook for a specific CLOB token
hl markets orderbook <tokenId>
hl markets orderbook <tokenId> --size 1000
```

### Assess

Run AI-powered risk assessments interactively.

```bash
# Start an interactive chat assessment
hl assess

# List past assessments
hl assess list
hl assess list --status completed

# View a specific assessment
hl assess show <id>

# Delete an assessment
hl assess delete <id>
```

### Hedge

Calculate hedge positions from a risk profile JSON file.

```bash
# From a file
hl hedge profile.json

# From stdin
echo '{
  "location": "33109",
  "assetType": "residential",
  "riskTypes": ["hurricane", "flood"],
  "assetValue": 500000
}' | hl hedge -
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
hl --json markets search "flood" | jq '.markets[].question'
hl --json assess list | jq '.[0].id'
```

## Development

```bash
git clone https://github.com/hedgelayer/cli.git
cd cli
npm install
npm run build        # Build with tsup
npm run dev          # Watch mode

# Test against local dev server
node dist/index.mjs --api-url http://localhost:3000 markets search "test"
```

## Publishing

Releases are automated via GitHub Actions. To publish a new version:

```bash
npm version patch    # or minor / major
git push --tags
```

The workflow builds and publishes to npm when a version tag (`v*`) is pushed. Requires an `NPM_TOKEN` secret in the repo settings.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT
