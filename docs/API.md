# Hedge Layer API Reference

This document describes the API endpoints used by the CLI. **Official documentation:** [https://hedgelayer.ai/docs](https://hedgelayer.ai/docs) → [API Reference](https://hedgelayer.ai/docs/api).

**Base URL:** `https://hedgelayer.ai`

**Authentication:** Bearer token (API tokens from https://hedgelayer.ai/settings → API Tokens). Most endpoints require auth except `GET /api/orderbook`.

---

## Endpoints (per official docs)

### Assessments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assessments?list=true` | Yes | List all assessments. Query: `status?` to filter. |
| GET | `/api/assessments` | Yes | Get most recent assessment (no `list=true`). |
| POST | `/api/assessments` | Yes | Create a new assessment. Returns `{ id: string }`. |
| GET | `/api/assessments/:id` | Yes | Get a specific assessment. |
| PATCH | `/api/assessments/:id` | Yes | Update an assessment. |
| DELETE | `/api/assessments/:id` | Yes | Delete an assessment. |

### AI & Hedging

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | Yes | Run AI risk assessment (streaming). Body: `{ messages, assessmentId? }`. Uses Vercel AI SDK data stream protocol (SSE). |
| POST | `/api/hedge` | Yes | Calculate hedge bundle. Requires risk profile + mapped markets (from search). |

### Markets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/search` | Yes | Search Polymarket markets. *(Note: may require POST in practice.)* |
| GET | `/api/orderbook` | No | Get orderbook data. Query: `tokenId` (required), `size?` (for slippage). Returns 404 for invalid token IDs. |

### Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/profile` | Yes | Get current user profile. Returns `{ user_id, handle, created_at, updated_at }`. |

---

## CLI usage

The CLI uses:

- **`hl assess`** — POST `/api/assessments`, POST `/api/chat` (stream)
- **`hl hedge`** — POST `/api/chat` with a risk-profile prompt (AI searches markets and builds bundle in one stream; `/api/hedge` expects pre-mapped markets)
- **`hl markets orderbook`** — GET `/api/orderbook`
- **`hl profile`** — GET `/api/profile`

---

## Response Shapes

### Orderbook

```json
{
  "book": { "bids": [{ "price": "0.50", "size": "100" }], "asks": [...] },
  "spread": { "bid": 0.50, "ask": 0.52, "spread": 0.02 },
  "askDepth": 5000,
  "slippage": { "avgPrice": 0.51, "worstPrice": 0.53, "slippage": 0.02, "fillableSize": 100 } | null
}
```

### Assessment

```json
{
  "id": "...",
  "user_id": "...",
  "status": "in_progress" | "completed" | "abandoned",
  "risk_profile": { "location", "assetType", "riskTypes", "assetValue" } | null,
  "hedge_bundle": { "positions", "totalCost", "totalCoverage", "hedgeEfficiency", "assetValue" } | null,
  "messages": [],
  "metadata": {},
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

## Notes

- Token IDs for `orderbook` can be obtained from Polymarket's Gamma API: `https://gamma-api.polymarket.com/markets` (see `clobTokenIds` in market objects).
- The legacy `/api/markets` endpoint was removed; `/api/search` is the current search endpoint (see [CHANGELOG](../CHANGELOG.md)).
