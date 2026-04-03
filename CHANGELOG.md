# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-04-02

### Added

- Feed result rendering in interactive research sessions. When the AI agent calls `getFeed` (fast quantitative market screening), the CLI now displays a formatted terminal table with rank, market, probability, attention score, 24h volume, liquidity, and color-coded price change — plus score bars and Polymarket links for the top 5 markets.
- Stream parser detects `getFeed` tool output alongside `buildMarketBrief`, exposed as `feedResult` on `StreamResult`.
- `FeedResult` and `FeedResultMarket` types matching the web app's `getFeed` tool output shape.
- `compactCurrency()` output helper for compact dollar formatting ($1.5M, $250.0K).

### Removed

- `--no-stream` option from `hl brief`. Briefs now always stream progress — the blocking mode added unnecessary complexity with no real benefit.

## [1.1.0] - 2026-04-01

### Added

- `hl brief <query>` — generate a Market Brief directly from a topic, no interactive session required. Streams progress to stderr and outputs the final brief to stdout.
- Brief command options: `--location`, `--time-horizon`, `--tags`, `--min-volume`, `--max-yes-price`.
- NDJSON streaming support via new `streamNdjson` method on `ApiClient` and `parseNdjsonStream` parser — consumes the `POST /api/brief` endpoint.
- `BriefRequest` and `BriefRequestFilters` types for the brief API request schema.

### Changed

- Quick Start in README now highlights `hl brief` as the primary command alongside `hl research`.

## [1.0.0] - 2026-03-29

### Breaking Changes

- **Rename `hl assess` to `hl research`.** The CLI now reflects the updated product thesis: prediction market intelligence and information flow, not risk assessment and hedging.
- **Remove `hl hedge` command.** Hedge bundle calculation has been removed. The product focus is Market Briefs — structured intelligence with causal reasoning and coverage gaps.
- **Remove hedge/risk types.** `RiskProfile`, `HedgeBundle`, `HedgePosition`, `MappedMarket` types are replaced by `MarketBrief` and `MarketBriefMarket`.

### Added

- `hl research` — interactive AI-powered market research sessions that produce Market Briefs
- `hl research list` — list past research sessions with brief titles and market counts
- `hl research show <id>` — display session details including full Market Brief (title, thesis, markets with causal links, coverage gaps)
- Market Brief display in terminal: title, thesis, markets table (prob, signals, liquidity), causal link detail, coverage gaps

### Changed

- CLI description: "hedge real-world risks on Polymarket" → "prediction market intelligence from the terminal"
- Stream parser detects `buildMarketBrief` tool output instead of `buildHedgeBundle`
- Assessment type updated: `market_brief` field replaces `risk_profile` and `hedge_bundle`

### Unchanged

- `hl auth login/status/logout` — no changes
- `hl markets orderbook` — no changes
- `hl profile` — no changes
- Global options (`--json`, `--api-url`, `--token`, `--verbose`, `--no-color`) — no changes

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

[1.2.0]: https://github.com/hedgelayer/cli/releases/tag/v1.2.0
[1.1.0]: https://github.com/hedgelayer/cli/releases/tag/v1.1.0
[1.0.0]: https://github.com/hedgelayer/cli/releases/tag/v1.0.0
[0.2.0]: https://github.com/hedgelayer/cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/hedgelayer/cli/releases/tag/v0.1.0
