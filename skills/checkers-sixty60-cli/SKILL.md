---
name: checkers-sixty60-cli
description: Use the Checkers Sixty60 CLI from terminal-based agent workflows. Trigger when the user asks to authenticate, request/verify OTP, fetch orders, view cart contents, search products, or add items to basket via the local `checkers-sixty60` command.
---

# Verify CLI Availability

1. Run `checkers-sixty60 --help`.
2. If unavailable, run `npm i -g checkers-sixty60`.
3. If global install is not desired, run from repo with `node dist/cli.js --help`.

# Authenticate Non-Interactively

1. Request OTP: `checkers-sixty60 request-otp --phone <phone>`.
2. Verify OTP: `checkers-sixty60 verify-otp --phone <phone> --otp <code>`.
3. Use `--reference <ref>` only when the saved pending reference is missing.

Notes:

- Keep phone in SA format accepted by the CLI (for example `0821234567` or `+27821234567`).
- The CLI stores auth state in `~/.checkers-sixty60/auth.json`.
- Persist location with `checkers-sixty60 set-location --lat <value> --lng <value>`.
- Set location with `SIXTY60_LATITUDE` and `SIXTY60_LONGITUDE` when store results/cart context look wrong for the user area.

Example:

- `checkers-sixty60 set-location --lat -26.2041 --lng 28.0473`
- `SIXTY60_LATITUDE=-26.2041 SIXTY60_LONGITUDE=28.0473 checkers-sixty60 view-cart`

# Fetch Orders

Use one of:

- Compact: `checkers-sixty60 orders --compact`
- Full JSON: `checkers-sixty60 orders --json`

Prefer `--compact` when an agent needs structured summaries quickly.

# View Cart

Use:

- `checkers-sixty60 view-cart`

Use this before and after basket mutations to verify line items and totals.

# Search Products

Use:

- `checkers-sixty60 search --query <text> --compact`
- Optional paging: `--page <n> --size <n>`

Use compact output by default for product selection steps.

# Add Item to Basket

Use:

- `checkers-sixty60 add-to-basket --product-id <id> --qty <n>`
- Optional cart selection: `--cart-id <id>`

Guidance:

- Use quantity `1` when user did not specify quantity.
- Validate that `--qty` is a positive integer.

# Failure Recovery

1. If auth context errors occur, rerun request+verify OTP flow.
2. If command fails with validation errors, fix flags and retry once.
3. If API returns authorization failures after login, re-authenticate.

# Safety

1. Never print OTP codes, access tokens, or auth file contents in full.
2. Redact sensitive header/token values when sharing command output.
