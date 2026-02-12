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

## Install

```bash
npm i -g checkers-sixty60
checkers-sixty60 --help
```

## Agent Skill

This repo includes a local skill for terminal-based AI agents:

- `skills/checkers-sixty60-cli/SKILL.md`

Use it when an agent needs structured guidance for auth, orders, product search, and basket operations through the `checkers-sixty60` CLI.

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
