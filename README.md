## Getting Started

First, run the development server:

## Development

pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm build && node scripts/package-portable.mjs

# copy a Node binary into dist/Vaultbook-Portable/node/bin/node, then

pnpm selftest:portable # expect {"ok":true,...}
bash dist/Vaultbook-Portable/start.sh
