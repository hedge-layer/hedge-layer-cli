# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.1.0] - 2026-06-14

### Added

- Add `hl feed ensemble` to run multiple existing feed profiles and sorts, de-dupe markets by slug, preserve source profile provenance, re-rank candidates with a deterministic ensemble score, and write local candidate JSON.
- `hl lp allocator --pnl <file>` submits per-market PnL context (a JSON array or `{ "pnl_context": [...] }`, e.g. `hl-trader pnl --json` output) so the allocator's PnL caution overlay can downgrade borderline allocations on markets with negative or locked-loss PnL.
- `hl lp allocator --allocations <file>` now also accepts an `{ "allocations": [...] }` wrapper, so one `hl-trader pnl --json` file can serve both `--pnl` and `--allocations`.

## [2.0.0] - 2026-06-10

### Added

- `hl lp allocator --markets <file>` can now submit an explicit candidate market JSON array, or `{ "markets": [...] }`, through the web API to the allocator agent, matching the direct-payload pattern used by `hl signal analyze --market`.

### Changed

- Allocator output now shows quote regime and split spread/reward/net economics when those fields are returned by the allocator agent.
- `hl lp allocator --markets <file>` now calls `POST /api/lp/allocator` instead of the removed `POST /api/allocator/cycle` endpoint.

### Removed

- Removed the top-level `hl allocator cycle` command and its feed-fetch/repeat-cycle convenience flow. Use `hl feed` followed by `hl lp allocator --markets <file>` instead.
- Removed `hl lp run` because the web app no longer exposes the scheduled/full-loop LP run endpoint.

## [1.8.0] - 2026-06-09

### Added

- `hl signal analyze` — call the Hedge Layer signal agent from the terminal to estimate true YES probability, compare it with current market pricing, and display probability gap, signal strength, confidence, key factors, and research findings.
- Signal analysis supports Polymarket URL input, repeated `--url` values, prior search context via `--context`, and inline market JSON from a file or stdin.

### Changed

- `hl research show` and `hl research delete` now accept the short 8-character session ID printed by `hl research list` (in addition to the full UUID), resolving it automatically. Unknown or ambiguous IDs produce a clear, actionable error instead of `API error 400: Invalid assessment ID`.

### Documentation

- Document global-install troubleshooting in the README: the `EACCES` permission fix via a user-writable npm prefix, and how to avoid (or safely ignore) the cosmetic `nvm` `npmrc prefix` warning.

## [1.7.0] - 2026-06-05

### Added

- Wallet funding commands under `hl wallet` for status, balances/funds, deposit instructions, and browser-signed withdrawal intents.
- Polygon asset display for pUSD, USDC.e, and native POL wallet balances.

### Changed

- `hl wallet status` now reports MetaMask owner wallet, Polymarket deposit wallet, deposit readiness, approval, deployment, and relayer configuration.
- Replace user-facing Magic wallet wording with owner/deposit wallet terminology in CLI help and README docs.
- Document POL gas requirements for browser-signed wallet withdrawals.

## [1.6.0] - 2026-06-04

### Changed

- Point the package README to the canonical CLI guide in the Hedge Layer web app docs.
- Bump the CLI package version to `1.6.0`.

### Fixed

- Update `vitest` to `^4.1.8` to resolve the critical dev-dependency audit advisory for the Vitest UI server.

## [1.5.0] - 2026-05-22

### Added

- `hl allocator cycle` — fetches LP candidate markets from `GET /api/feed` and runs the account-authenticated dry-run allocator loop through `POST /api/allocator/cycle`, including optional repeat cycles from returned target allocations.
- `liquidity-provider` feed profile support in the CLI to match the web app’s allocator-oriented screen.

## [1.4.0] - 2026-05-10

### Added

- `hl feed` — calls `GET /api/feed` with the same query parameters as the web agent’s `getFeed` tool. Positional shorthand `hl feed lp-opportunity` and `hl feed liquid-new-or-long` map to the server’s curated screening profiles (thin-book LP yield vs. liquid new-or-long-dated markets).

### Changed

- Feed table output from interactive `hl research` now includes the attention **preset** name in the header; shared rendering lives in `src/feed-display.ts`.

## [1.3.0] - 2026-05-10

### Fixed

- `hl research run` called `POST /api/research`, which is not implemented on the Hedge Layer web app. It now uses `POST /api/brief` with `stream: false` and prints the Market Brief JSON on success.

### Added

- `ApiClient.postBriefSync()` for blocking brief generation (JSON body plus optional telemetry from response headers).
- Interactive `hl research` saves progress after each assistant turn by calling `PATCH /api/assessments/:id` with `messages` and `metadata`. When the agent produces a brief, the patch also sets `market_brief` and `status: "completed"`, consistent with the web client’s behavior so sessions appear in `hl research list` / `hl research show`.
- Tests for `postBriefSync`.
- `CLAUDE.md` documenting commands and API endpoints for agent workflows.

### Changed

- README: document `hl research run`; remove stale `hl brief --no-stream` examples (the flag was removed in 1.2.0).
- AGENTS.md: drop references to the removed `markets orderbook` command.

### Removed

- `ResearchResponse` TypeScript interface (no longer used).

### Notes

- Full brief titles and market counts in `hl research list` require the API list endpoint to include `market_brief` on each assessment row (server-side change shipped alongside this release).

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

[1.8.0]: https://github.com/hedge-layer/hedge-layer-cli/releases/tag/v1.8.0
[1.7.0]: https://github.com/hedge-layer/hedge-layer-cli/releases/tag/v1.7.0
[1.6.0]: https://github.com/hedge-layer/hedge-layer-cli/releases/tag/v1.6.0
[1.5.0]: https://github.com/hedge-layer/hedge-layer-cli/releases/tag/v1.5.0
[1.4.0]: https://github.com/hedge-layer/hedge-layer-cli/releases/tag/v1.4.0
[1.3.0]: https://github.com/hedge-layer/hedge-layer-cli/releases/tag/v1.3.0
[1.2.0]: https://github.com/hedgelayer/cli/releases/tag/v1.2.0
[1.1.0]: https://github.com/hedgelayer/cli/releases/tag/v1.1.0
[1.0.0]: https://github.com/hedgelayer/cli/releases/tag/v1.0.0
[0.2.0]: https://github.com/hedgelayer/cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/hedgelayer/cli/releases/tag/v0.1.0
