# Changelog

## 0.2.0 (2026-03-01)

### Breaking Changes

- **Remove `hl markets search` command.** The `/api/markets` endpoint it depended on was removed from the Hedge Layer web app. Use the AI assessment flow (`hl assess`) for market discovery instead.

### Unchanged

- `hl markets orderbook <tokenId>` — still available via `/api/orderbook`
- `hl assess`, `hl hedge`, `hl auth`, `hl profile` — no changes

## 0.1.0 (2026-02-15)

Initial release.

- `hl auth login/status/logout` — API token management
- `hl markets search <query>` — search Polymarket markets
- `hl markets orderbook <tokenId>` — orderbook spread and depth
- `hl assess` — interactive AI risk assessment
- `hl assess list/show/delete` — assessment management
- `hl hedge <file>` — calculate hedge from risk profile JSON
- `hl profile` — view account info
- Global flags: `--json`, `--api-url`, `--token`, `--verbose`, `--no-color`
