# Handoff
Updated: 2026-08-30

Branch: chore/tooling-bootstrap. Tripwire 2/3.
A0 complete (E2E org, user, Stripe sandbox config, secrets). A1 in progress.
A2 done; tripwire 2/3 (miss: first gate-lint.mjs resolved `eslint/bin/eslint.js` directly, blocked by eslint's `exports` map; fixed via package.json `bin`). `npm run gate` = gate:tsc + gate:lint + gate:build + gate:unit. Wrappers in `scripts/gate-*.mjs` are TRANSITIONAL (delete Day 7 at tsc=0/lint=0; lint baseline in `scripts/gate-baselines.json`). vitest pinned ^3.2.7 (vitest 4 needs vite ≥ 6; installed vite 5.4). `vite.config.ts` Sentry guard wrapped in `Boolean()` so `tsconfig.node.json` typechecks clean.
