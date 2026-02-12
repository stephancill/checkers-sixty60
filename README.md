# Checkers Sixty60 CLI (Bun + TypeScript)

This project provides a Bun CLI for:

- interactive auth (phone + OTP)
- local token persistence
- authenticated order fetch

## Run

```bash
bun install
bun run start
```

## Non-interactive usage

```bash
# Step 1: send OTP
bun run start request-otp --phone 0821234567

# Step 2: verify OTP and persist auth
bun run start verify-otp --phone 0821234567 --otp 1234

# Fetch orders (JSON output)
bun run start orders --json

# Fetch orders (compact output)
bun run start orders --compact

# Search products
bun run start search --query milk --compact

# Add product to basket (qty defaults to 1)
bun run start add-to-basket --product-id 5d3af63cf434cf8420737e3e --qty 1
```

The CLI saves tokens to:

- `~/.checkers-sixty60/auth.json`