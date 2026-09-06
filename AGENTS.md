# Repository instructions

This is `@hedge-layer/cli`, a thin TypeScript HTTP client for Hedge Layer's
unified financial data and execution tools. There is no backend or agent in
this repository. The `hl` binary requires Node.js 22 or later.

## Architecture

- `src/program.ts`: Commander command registration.
- `src/commands/tools.ts`: `tools [name]` and `call <name>` with JSON input.
- `src/client.ts`: authenticated HTTP requests to `/api/v1/tools`.
- `src/commands/auth.ts`: hidden token prompt and catalog-based validation.
- `src/config.ts`: private local credential configuration.
- `src/index.ts`: entry point and process error handling.

Tool schemas and implementation belong to the server. Keep the CLI generic;
do not add research workflows, provider SDKs, strategies, or mirrored domain
types. MCP and HTTP calls must invoke the same server tools.

## Checks

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
Integration tests build the binary and run it against a local mock HTTP server.
No account, database, or external service is needed.

## Execution and credentials

Never automatically retry tool calls, including submission and cancellation.
Keep the complete MCP result and return nonzero for `isError: true`. Preserve
signed request body strings exactly. Do not log tokens, arguments, or headers.
Use HTTPS except for loopback development; reject redirects. Credentials are
stored at `~/.hedgelayer/config.json` with mode `0600`.

Flags override `HL_API_URL`/`HL_TOKEN`, which override saved configuration.
The CLI does not load `.env` files.
