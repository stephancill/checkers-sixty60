# Agent Notes (Repo)

This repo is a Node-compatible TypeScript CLI for interacting with Checkers Sixty60.

## Quick Start

```bash
bun install

# dev (runs TS directly)
bun run start -- --help

# build (emits dist/)
npm run build

# run built CLI
node dist/cli.js --help
```

## Core Commands

- Auth:
  - `checkers-sixty60 request-otp --phone <phone>`
  - `checkers-sixty60 verify-otp --phone <phone> --otp <code> [--reference <ref>]`
- Orders:
  - `checkers-sixty60 orders --compact`
  - `checkers-sixty60 orders --json`
- Cart:
  - `checkers-sixty60 view-cart`
  - `checkers-sixty60 add-to-basket --product-id <id> --qty <n> [--cart-id <id>]`
- Search:
  - `checkers-sixty60 search --query <text> --compact`

## Local State

- Auth state: `~/.checkers-sixty60/auth.json`
- Device id: `~/.checkers-sixty60/device.json`
- Location settings: `~/.checkers-sixty60/settings.json`

## Location Handling

Many endpoints depend on latitude/longitude to resolve store contexts.

- Persist across sessions:
  - `checkers-sixty60 set-location --lat <value> --lng <value>`
- Override per session:
  - `SIXTY60_LATITUDE=<lat> SIXTY60_LONGITUDE=<lng> checkers-sixty60 view-cart`

Resolution order:
1. env vars
2. saved settings file
3. generic defaults

## Code Map

- `src/cli.ts`: argument parsing and command routing
- `src/api.ts`: HTTP calls and request/response shaping
- `src/http.ts`: fetch wrapper (throws on non-2xx)
- `src/storage.ts`: local JSON persistence helpers
- `src/config.ts`: file paths and constants

## Formatting / Linting

Use Biome:

```bash
bun run format
bun run lint
```

## Publishing to npm

- Do not commit `dist/`.
- `npm publish` runs `prepublishOnly` which calls `npm run build`.

Typical release:

```bash
npm version patch --no-git-tag-version
npm publish --access public --otp <OTP>
```

## Traffic Capture / Debugging

Use mitmproxy/mitmweb when endpoints drift.

```bash
mitmweb --listen-host 127.0.0.1 --listen-port 8080 -w checkers.flows
mitmdump -nr checkers.flows --set hardump=checkers.har
```

Add capture artifacts to local exclude (do not commit HAR/flows).

## Safety + Hygiene

- Never commit or paste personal data (phone numbers, addresses, precise lat/lng, tokens).
- Prefer placeholder examples in docs and help text.
- If secrets/PII accidentally land in git history, use `git filter-repo` to rewrite history and then force-push with lease.
