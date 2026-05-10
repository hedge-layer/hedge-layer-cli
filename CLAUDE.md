# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hedge Layer CLI (`@hedge-layer/cli`) — a TypeScript command-line client for the Hedge Layer prediction market intelligence platform at https://hedgelayer.ai. This is a thin HTTP client; there is no backend in this repo.

Published on npm as `@hedge-layer/cli` (v1.3.0). Binary name: `hl`.

## Commands

```bash
npm run build        # Build to dist/index.mjs (tsup)
npm run dev          # Watch mode rebuild
npm run lint         # ESLint (flat config, typescript-eslint)
npm test             # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```

Run the CLI after build: `node dist/index.mjs [options] [command]`

## Architecture

### CLI Commands

| Command | Purpose |
|---------|---------|
| `hl brief <query>` | Generate Market Brief (streams NDJSON from `/api/brief`) |
| `hl research start` | Interactive AI research session (streams SSE from `/api/chat`) |
| `hl research run <query>` | Non-interactive Market Brief as JSON (`POST /api/brief` with `stream: false`) |
| `hl research list` | List past sessions |
| `hl research show <id>` | Display session details |
| `hl research delete <id>` | Delete session |
| `hl auth login` | Interactive token setup |
| `hl auth status` | Check authentication |
| `hl auth logout` | Remove stored token |
| `hl profile` | Show user profile |

### Global Options

- `--json` — Machine-readable JSON output
- `--api-url <url>` — Override API base (default: `https://hedgelayer.ai`)
- `--token <token>` — Supply token inline (for CI/scripts)
- `--verbose` — Show HTTP request/response details
- `--no-color` — Disable ANSI colors

### Key Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point, Commander CLI setup |
| `src/client.ts` | HTTP client (GET, POST, PATCH, DELETE, streaming SSE/NDJSON, `postBriefSync`) |
| `src/stream.ts` | Stream parsers for SSE and NDJSON protocols |
| `src/config.ts` | Config file management (`~/.hedgelayer/config.json`) |
| `src/output.ts` | Terminal formatting (chalk tables, colors, currency) |
| `src/types.ts` | Domain types (MarketBrief, Assessment, FeedResult) |
| `src/commands/brief.ts` | Market Brief generation command |
| `src/commands/research.ts` | Interactive research commands |
| `src/commands/auth.ts` | Auth login/status/logout |
| `src/commands/profile.ts` | Profile display |

### API Endpoints Consumed

All calls go to `https://hedgelayer.ai` (or `--api-url` override):

- `POST /api/brief` — Market Brief (`hl brief`: NDJSON stream; `hl research run`: JSON body, `stream: false`)
- `POST /api/chat` — Interactive research (SSE stream)
- `POST /api/assessments` — Create research session
- `PATCH /api/assessments/{id}` — Update session (CLI persists chat turns here)
- `GET /api/assessments` — List sessions (`list=true`)
- `GET /api/assessments/{id}` — Get session
- `DELETE /api/assessments/{id}` — Delete session
- `GET /api/profile` — User profile

Auth: Bearer token via `Authorization: Bearer hl_*` header.

### Environment

- Requires Node.js >= 22
- No Docker, databases, or external services needed locally
- User credentials stored at `~/.hedgelayer/config.json`

## Testing

Tests in `src/*.test.ts` (client, stream, output). Uses `vi.mock()` for config isolation and `vi.spyOn(globalThis, 'fetch')` for HTTP mocking. No network access needed.

## Publishing

GitHub Actions (`.github/workflows/publish.yml`) publishes to npm on git tags (`v*`) using OIDC trusted publishers.
