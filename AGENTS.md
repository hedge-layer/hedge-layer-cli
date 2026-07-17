# AGENTS.md

## Cursor Cloud specific instructions

This is a TypeScript CLI tool (`@hedge-layer/cli`) that acts as a thin client to the Hedge Layer API at `https://hedgelayer.ai`. There is no backend in this repo.

Hedge Layer is a prediction market intelligence platform. The v4 CLI provides terminal access to discovery, Signal analysis, non-executing directional quote previews, and Market Briefs.

### Key commands

See `package.json` scripts and `README.md` for standard commands:

- **Build:** `npm run build` (produces `dist/index.mjs` via tsup)
- **Dev watch:** `npm run dev`
- **Run CLI:** `node dist/index.mjs [options] [command]`
- **Tests:** `npm run test` (vitest — tests in `src/*.test.ts`)
- **Lint:** `npm run lint` (eslint with typescript-eslint flat config)

### Running the CLI

After `npm run build`, run the CLI with `node dist/index.mjs`. Most commands require an API token. Use `--api-url` to point to a local dev server or `--token` to supply a token inline.

### Environment

- Requires Node.js >= 22 (the VM has v22 pre-installed).
- No Docker, databases, or external services needed locally.
- User credentials stored at `~/.hedgelayer/config.json`.
