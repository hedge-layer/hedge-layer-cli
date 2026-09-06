# Changelog

## Unreleased

- Replace the research CLI with `hl tools [name]` and `hl call <name>` against
  Hedge Layer's shared HTTP/MCP tool catalog.
- Read arguments from JSON, files, or stdin; return complete JSON tool results
  and nonzero status for failures.
- Keep token login, validation, and logout; support `HL_API_URL` and `HL_TOKEN`.
- Remove research sessions, briefs, feeds, signals, quote previews, profile
  display, stream parsers, terminal renderers, and unused dependencies.
- Preserve signed execution payloads without retrying calls. Require HTTPS
  except loopback development, reject redirects, and save credentials privately.

This is a breaking fresh start. Earlier release history is available in Git.
