---
name: hl-cli-e2e-verification
description: "Use when asked to install the Hedge Layer CLI (`@hedge-layer/cli`, binary `hl`) and/or run an end-to-end smoke test against the live API. Covers global install on locked-down VMs, non-interactive authentication with an injected API token, and verifying every command (auth, profile, feed, brief, research, wallet). Triggers: 'install the hl cli', 'install latest cli tool', 'run an end to end cycle', 'confirm the CLI works', 'smoke test the hedge layer cli'."
metadata:
  author: hedge-layer
  version: "1.0.0"
---

# Hedge Layer CLI — Install & End-to-End Verification

A repeatable playbook for installing `@hedge-layer/cli` (binary `hl`) and running a full
end-to-end smoke test against the production API (`https://hedgelayer.ai`).

## TL;DR

```bash
# 1. Install latest into a user-writable prefix (avoids root EACCES on locked-down VMs)
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
npm install -g @hedge-layer/cli@latest
hl --version            # expect the latest, e.g. 1.7.0

# 2. Authenticate non-interactively (token is in env, e.g. $HEDGE_LAYER_API_KEY, format hl_*)
python3 -c "import json,os; open(os.path.expanduser('~/.hedgelayer/config.json'),'w').write(json.dumps({'api_url':'https://hedgelayer.ai','token':os.environ['HEDGE_LAYER_API_KEY']},indent=2))"
hl auth status          # expect a Handle + User ID

# 3. Smoke test (fast commands first, then the slow AI flows)
hl profile
hl feed --limit 5
hl brief "Federal Reserve interest rate decisions in 2026" --time-horizon 2026   # ~100s, streams NDJSON
hl --json research run "Bitcoin price milestones in 2026" > /tmp/run.json         # ~120s, JSON brief
hl research list
hl wallet status
```

## Step 1 — Install the latest version

The published package is `@hedge-layer/cli` on npm; binary is `hl`. Requires Node >= 22.

- **Permission gotcha:** a plain `npm install -g` often fails with `EACCES`/"operation was
  rejected by your operating system" because the default prefix points at a root-owned dir
  (e.g. `/usr/lib/node_modules`), and `sudo npm` usually isn't available. **Fix:** set a
  user-level prefix and put its `bin/` on `PATH`:

  ```bash
  mkdir -p "$HOME/.npm-global"
  npm config set prefix "$HOME/.npm-global"
  export PATH="$HOME/.npm-global/bin:$PATH"
  npm install -g @hedge-layer/cli@latest
  ```

- Confirm: `hl --version` (compare against `npm view @hedge-layer/cli version`).
- **Cosmetic noise:** if `nvm` is active, every shell may print
  `Your user’s .npmrc file ... has a globalconfig and/or prefix setting ... incompatible with nvm`.
  This is harmless — `hl` still works. It comes from nvm's shell init reading the custom
  prefix, not from `hl`. Ignore it, or filter with
  `2>&1 | grep -v "npmrc\|globalconfig\|nvm\|incompatible\|Your user"`.

## Step 2 — Authenticate (non-interactive)

The token format is `hl_*`. In automated/cloud environments it is typically injected as an
env var (e.g. `HEDGE_LAYER_API_KEY`). There are exactly **three** ways the CLI accepts a token,
and only the first two are reliable:

1. **`--token <token>` global flag** (best for one-off/CI):
   `hl --token "$HEDGE_LAYER_API_KEY" auth status`
2. **Config file** `~/.hedgelayer/config.json` (best for a whole session — write once):
   ```json
   { "api_url": "https://hedgelayer.ai", "token": "hl_..." }
   ```
3. ⚠️ **Env var / `.env` does NOT work** in the published CLI (tested through v1.7.0).
   Despite `.env.example` advertising `HL_TOKEN` / `HL_API_URL`, neither a shell-exported
   `HL_TOKEN` nor a `.env` file in the cwd is picked up — `hl auth status` and API commands
   both report "Not logged in". Do **not** rely on env-var auth; map the env token into the
   config file or pass `--token`.

Verify with `hl auth status` → should show `Handle` and `User ID`. (Note: `auth status`
reflects only the stored config file, not a `--token` flag — use a real command like
`hl profile` to confirm a `--token` works.)

## Step 3 — End-to-end smoke test

Run lightweight read commands first, then the slow AI generation flows. Add `--json` to any
command for machine-readable output.

| Command | What it exercises | Expected | Latency |
|---|---|---|---|
| `hl auth status` / `hl profile` | Auth + identity | Handle + User ID | instant |
| `hl feed --limit 5` | `GET /api/feed` ranking engine | Table of ranked markets w/ score, vol, liq | ~2s |
| `hl brief "<topic>"` | `POST /api/brief` NDJSON stream | Streamed progress then a Market Brief (title, thesis, markets, causal links, coverage gaps); ends `Done (Ns)` | ~90–120s |
| `hl --json research run "<topic>"` | `POST /api/brief` with `stream:false` | JSON with `title, thesis, markets[], watchlist, gaps[], marketCount, createdAt` | ~90–120s |
| `hl research list` / `hl research show <id>` | Session listing/detail | List of sessions; detail view | ~2s |
| `hl wallet status` | `wallet` read-only inspection | Owner + deposit wallet status flags | ~1s |

### Run the slow AI flows in the background

`hl brief` and `hl research run` each take ~1.5–2 minutes. Run them in a tmux session and poll,
rather than blocking a foreground shell:

```bash
SESSION=hl-brief
tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION" -c "$PWD" -- bash -l
tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$SESSION:0.0" \
  'export PATH="$HOME/.npm-global/bin:$PATH"; hl brief "<topic>" | tee /tmp/brief.txt; echo "EXIT=$?"' C-m
# then poll /tmp/brief.txt and capture-pane for the EXIT marker
```

## Gotchas (learned the hard way)

- **`hl research list` prints a truncated 8-char ID**, but `hl research show <id>` requires the
  **full UUID** — passing the short ID returns `API error 400: Invalid assessment ID`.
  Recover the full id with `hl --json research list`.
- **Env-var auth is unimplemented** (see Step 2) — always use `--token` or the config file.
- **Node >= 22 required.**
- Use `--api-url <url>` to point at a local/staging server instead of production.

## Success criteria

The CLI is healthy end-to-end when: install reports the latest version, `hl auth status` shows
the right handle, `hl feed` returns ranked markets, **both** `hl brief` (NDJSON stream) and
`hl research run` (JSON) produce a complete Market Brief with non-empty `markets[]`, and
`hl wallet status` returns wallet flags — all with exit code 0.
