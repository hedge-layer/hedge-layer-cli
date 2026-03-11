# Hedge Layer API Reference

This document describes the API endpoints used by the CLI. There is no official public API documentation; this reference is derived from the CLI implementation and live API testing (March 2026).

**Base URL:** `https://hedgelayer.ai`

**Authentication:** Bearer token (API tokens from https://hedgelayer.ai/settings → API Tokens). Most endpoints require auth except `GET /api/orderbook`.

---

## Endpoints

### Assessments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/assessments` | Yes | Create a new assessment. Returns `{ id: string }`. |
| GET | `/api/assessments` | Yes | List assessments. Query: `list=true`, `status?`. Returns `{ assessments: Assessment[] }`. |
| GET | `/api/assessments/:id` | Yes | Get assessment by ID. |
| DELETE | `/api/assessments/:id` | Yes | Delete an assessment. |

### Chat (Streaming)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | Yes | Stream AI chat. Body: `{ messages, assessmentId? }`. Uses Vercel AI SDK data stream protocol (SSE). |

### Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/profile` | Yes | Get current user profile. Returns `{ user_id, handle, created_at, updated_at }`. |

### Markets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/orderbook` | No | Get orderbook for a Polymarket CLOB token. Query: `tokenId` (required), `size?` (for slippage). Returns 404 for invalid/unavailable token IDs. |

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
- The `/api/markets` search endpoint was removed in a prior API change; use the AI assessment flow for market discovery.
