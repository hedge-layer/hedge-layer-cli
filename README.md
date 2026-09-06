# @hedge-layer/cli

Hedge Layer is a unified layer for financial data and trade execution. The `hl`
CLI calls its HTTP API; MCP clients use the same tools through `/mcp`. Agent H
is the supported agent client, and you can also use Codex, Claude Code, Python,
or any other client that can call the API.

The CLI contains no research agent or trading strategy. It discovers tool
schemas from the server and forwards the arguments you supply.

## Install

```bash
npm install -g @hedge-layer/cli
```

Requires Node.js 22 or later. These commands require a Hedge Layer server with
the `/api/v1/tools` API introduced by the unified-layer refactor.

## Quick start

Create an API token in your Hedge Layer account settings, then:

```bash
hl auth login
hl tools
hl tools search_markets
hl call search_markets --args '{"query":"bitcoin","venues":["polymarket","hyperliquid"],"limit":5}'
hl call list_polymarket_markets
hl call get_polymarket_orderbook --args '{"token_id":"<token-id>"}'
```

`hl auth login` hides token input. For scripts, provide `HL_TOKEN` through your
shell or secret manager. Set `HL_API_URL` to use another server, or pass
`--api-url http://localhost:3000` for local development.

## Commands

| Command | Behavior |
| --- | --- |
| `hl tools [name]` | List the server's tools and JSON Schemas, or inspect one tool |
| `hl call <name> [--args <json> \| --file <path> \| --stdin]` | Invoke a tool with a JSON object; defaults to `{}` |
| `hl auth login` | Validate and save an API token |
| `hl auth status` | Validate the active token against the tool catalog |
| `hl auth logout` | Remove the saved token; environment variables and flags still apply |

All successful command output is JSON on stdout. Prompts and diagnostics go to
stderr. `hl call` preserves the complete MCP result, including `content`,
`structuredContent`, and `isError`. Tool errors (`isError: true`) retain their
JSON output and exit with status 1. HTTP, network, and input errors also exit
with status 1, with a JSON error on stderr. Command-line usage errors are
printed by the argument parser.

Arguments must be a JSON object, using exactly one input source:

```bash
hl call search_markets --file query.json
cat query.json | hl call search_markets --stdin
hl call search_markets --args '{"query":"bitcoin"}' | jq '.structuredContent'
```

Use `hl tools` as the authoritative list for your server. Tool names, schemas,
and `requiredScope` come from the API, so the CLI does not need a release when
a provider adds a tool.

## Execution

Polymarket order submission, cancellation, and order lookup use locally signed
venue requests. Create a Hedge Layer token with `trade` scope for these tools.
New tokens are read-only by default. Inspect the exact schemas first:

```bash
hl tools submit_polymarket_order
hl tools cancel_polymarket_order
hl tools get_polymarket_order
```

Use the venue SDK locally to sign the order and its request authentication.
Your signing code should produce an arguments object containing `signed_body`
(the exact signed request body as a string) and `auth` (address, API key,
passphrase, timestamp, and signature). Pass that object through stdin or a
private file so credentials do not enter shell history:

```bash
hl call submit_polymarket_order --stdin < signed-order-arguments.json
hl call cancel_polymarket_order --stdin < signed-cancellation-arguments.json
hl call get_polymarket_order --stdin < signed-order-lookup-arguments.json
```

Order lookup arguments contain `order_id` and `auth` instead of `signed_body`.
The CLI preserves the exact `signed_body` string. It never signs requests,
requests wallet private keys or CLOB API secrets, or retries calls. If a
submission times out, reconcile its status with the venue before submitting
again. See the [Hedge Layer execution guide](https://hedgelayer.ai/docs/execution)
for the server contract and signing workflow.

## Configuration

Options take precedence over environment variables, then saved configuration:

| Setting | Flag | Environment | Default |
| --- | --- | --- | --- |
| API origin | `--api-url` | `HL_API_URL` | `https://hedgelayer.ai` |
| API token | `--token` | `HL_TOKEN` | Token saved by `hl auth login` |
| HTTP diagnostics | `--verbose` | — | Off |

The CLI does not load `.env` files. Export variables in your shell or secret
manager. Configuration is saved to `~/.hedgelayer/config.json` with file mode
`0600`. URLs must use HTTPS, except HTTP loopback servers for development.
Redirects are rejected. Verbose output includes method, URL, and status only.

## Development

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
node dist/index.mjs --help
```

Tests cover the HTTP contract, the built binary against a local API server,
authentication, signed payload preservation, error exits, redirects, and
configuration permissions. They do not place live orders.

This is a fresh command surface: the former `brief`, `research`, `feed`,
`signal`, `quote`, and `profile` commands have been removed. Use the server's
tools directly and let your chosen agent handle research workflows.

## License

MIT
