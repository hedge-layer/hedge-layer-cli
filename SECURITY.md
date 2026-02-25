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
| 0.x     | Yes       |

## Token Security

- API tokens are stored locally in `~/.hedgelayer/config.json` and are never sent to third parties.
- Tokens are only transmitted to the Hedge Layer API over HTTPS.
- Never commit tokens or `.env` files to version control.
