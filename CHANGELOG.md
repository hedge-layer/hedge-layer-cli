# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-03-01

### Breaking Changes

- **Remove `hl markets search` command.** The `/api/markets` endpoint it depended on was removed from the Hedge Layer web app. Use the AI assessment flow (`hl assess`) for market discovery instead.

### Unchanged

- `hl markets orderbook <tokenId>` — still available via `/api/orderbook`
- `hl assess`, `hl hedge`, `hl auth`, `hl profile` — no changes

## [0.1.0] - 2026-02-25

### Added

- `hl auth login`, `hl auth status`, `hl auth logout` for API token management
- `hl markets search` to browse Polymarket prediction markets by keyword
- `hl markets orderbook` to view order book for a specific CLOB token
- `hl assess` for interactive AI-powered risk assessments
- `hl assess list`, `hl assess show`, `hl assess delete` for managing past assessments
- `hl hedge` to calculate hedge positions from a risk profile JSON file (file or stdin)
- `hl profile` to view the authenticated user's profile
- Global options: `--json`, `--api-url`, `--token`, `--verbose`, `--no-color`
- Token storage in `~/.hedgelayer/config.json`

[0.2.0]: https://github.com/hedgelayer/cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/hedgelayer/cli/releases/tag/v0.1.0
