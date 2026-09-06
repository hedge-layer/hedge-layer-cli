# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Email:** security@hedgelayer.ai

Please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Any relevant logs or screenshots

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation plan within 7 days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |

## Token Security

- API tokens are stored locally in `~/.hedgelayer/config.json` with file mode `0600`.
- Tokens are transmitted to your configured API origin over HTTPS (HTTP is allowed for loopback development). Redirects are rejected.
- Execution payloads contain venue authentication. Supply them through stdin or private files; never include wallet private keys or CLOB API secrets.
- The CLI does not retry tool calls. Reconcile an ambiguous order outcome before resubmitting.
- Never commit tokens or `.env` files to version control.
