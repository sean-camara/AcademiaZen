# Frontend test strategy

## Baseline

On 2026-07-19, `npm run test:run` passed 4 files/48 tests in 4.14 s. Coverage is concentrated in constants, helpers, the API timeout wrapper, and the error boundary. `npx tsc --noEmit` failed before modernization in `vitest.config.ts`; `npm run build` passed.

## Test layers

- Unit: date/timezone helpers, state compatibility mappers, schemas, quota/error mapping, focus timer reducer, service-worker message parsing.
- Component: auth forms, verification, dialogs/focus restore, task forms, offline/update banners, AI progress/errors/limits, billing states, notification permission states.
- Integration with MSW: token expiry/retry, state revision conflict, signed upload, SSE cancellation, duplicate mutation, failed checkout refresh.
- Playwright: public landing/static fallback; login and protected deep links; unverified/verified user; tasks/calendar/focus/library/review/Zen AI; quota reached; offline/reconnect; settings/logout; 390 px navigation; keyboard; reduced motion; stale service worker.
- Accessibility: semantic assertions plus automated axe checks and manual keyboard/screen-reader review for critical flows.

## Merge gate

Clean lockfile install, strict typecheck, lint, format check, unit/component tests, production build, critical Playwright smoke, bundle budget, and dependency review. Tests assert behavior and accessible names, not Tailwind class strings.

## Production smoke boundary

Use only public endpoints and a designated non-sensitive test account. Never delete, bulk edit, purchase, exhaust quota, or upload private material in production smoke tests.
