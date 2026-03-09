# AGENTS.md

## Cursor Cloud specific instructions

This is a TypeScript CLI tool (`@hedge-layer/cli`) that acts as a thin client to the Hedge Layer API at `https://hedgelayer.ai`. There is no backend in this repo.

### Key commands

See `package.json` scripts and `README.md` for standard commands:

- **Build:** `npm run build` (produces `dist/index.mjs` via tsup)
- **Dev watch:** `npm run dev`
- **Run CLI:** `node dist/index.mjs [options] [command]`
- **Tests:** `npm run test` (vitest — note: no test files exist yet)
- **Lint:** `npm run lint` (note: `eslint` is referenced in the lint script but not listed as a devDependency; this command currently fails with `eslint: not found`)

### Known gaps

- `eslint` is not in `devDependencies`, so `npm run lint` fails. If you need linting, install it first: `npm install --save-dev eslint`.
- No test files exist yet. `npm run test` exits with code 1 ("No test files found").

### Running the CLI

After `npm run build`, run the CLI with `node dist/index.mjs`. Most commands (assess, profile, hedge) require an API token. Use `--api-url` to point to a local dev server or `--token` to supply a token inline.

The `markets orderbook <tokenId>` command works without auth and can be used to verify end-to-end HTTP connectivity.

### Environment

- Requires Node.js >= 22 (the VM has v22 pre-installed).
- No Docker, databases, or external services needed locally.
- User credentials stored at `~/.hedgelayer/config.json`.
