# Frontend modernization plan

## Dependency order

1. **Safety foundation:** preserve `ZenState`; add strict configuration, environment validation, lint/format scripts, error contracts, CI, and characterization tests.
2. **Contract boundary:** introduce domain schemas/mappers and a typed API client compatible with the existing backend. No endpoint removal.
3. **Application shell:** route-level error boundaries/lazy routes, explicit `/login` and public `/`, boot/network/update providers.
4. **State split:** move remote reads/writes into query hooks; keep timer/form state local; add server revision conflicts before offline mutation queues.
5. **Feature extraction:** tasks/calendar, focus, library, review, Zen AI, billing/settings, and notifications, one tested vertical slice at a time.
6. **Design system/accessibility:** tokens and primitives, then migrate screens without changing business rules.
7. **Landing page:** DOM-first narrative, static visual fallback, then optional lazy 3D enhancement outside authenticated bundles.
8. **PWA/performance:** cache policy, update UX, route budgets, responsive images/fonts, slow-network verification.
9. **Release:** backend contract compatibility, clean CI, staging smoke, production backup, versioned deploy, monitoring, rollback.

## TypeScript/toolchain gate

The baseline uses TypeScript 5.8, Vite 6, Tailwind 3 and has a pre-existing typecheck failure because `vitest.config.ts` imports `defineConfig` from Vite. Fix baseline configuration before version upgrades. Verify that TypeScript 7 and Vite 8 are stable and ecosystem-compatible at implementation time; do not install prereleases into production merely to meet a label.

## Rollback

Each phase is a focused commit. Persisted schemas remain backward-readable. Feature extractions retain compatibility adapters until the new path passes unit/component/E2E checks; then remove the old path in the same phase. Production rollback is a previous image/release plus the prior frontend asset set; never depend on reversing student data.
