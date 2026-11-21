## Getting Started

First, install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

## Development

Check your code:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Build the portable version:

```bash
pnpm build && node scripts/package-portable.mjs
```

Test the portable version:

```bash
pnpm selftest:portable
bash dist/Vaultbook-Portable/start.sh
```
