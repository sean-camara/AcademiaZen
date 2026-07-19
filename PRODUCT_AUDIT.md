# Product and workflow audit

Audit date: 2026-07-19. Evidence: source inspection, clean production build, 48 frontend tests, public desktop/390 px browser captures, and read-only production checks. Authenticated flows were not exercised with a production user.

## Executive findings

The authenticated product is broad and functional, but its implementation is concentrated in very large screens and one state context. The public experience explains neither the product nor its trust model. Important recovery states exist unevenly; writes are last-writer-wins at whole-state granularity, making multi-tab/offline conflicts a material data-loss risk.

## Workflow map

| Workflow | Entry and happy path | Existing states | Principal risk / required acceptance |
|---|---|---|---|
| Public entry | `/` -> auth card | auth boot spinner | No product exploration, privacy/trust, or meaningful no-JS content. Add public landing without delaying auth. |
| Registration | Auth -> Sign Up -> email/password or Google | inline errors; pending profile cache | Prevent repeat submit; validate terms/privacy messaging; preserve Firebase account and pending profile across refresh. |
| Login/session | Auth -> Firebase -> auth observer | global spinner; errors | Deep links are lost because auth/layout routing is coupled. Preserve intended route and expired-token recovery. |
| Email verification | unverified gate -> resend/reload/sign out | resend message | Reload is the only refresh path; poll/reload Firebase user safely and rate-limit resend UI. |
| Dashboard/tasks | `/` -> add/edit/toggle/delete task | rich dashboard; modal confirmation | Whole-state synchronization risks overwriting concurrent changes; add pending/success/error/undo semantics. |
| Calendar | `/calendar` -> inspect due work | populated calendar | Validate timezone/date-only semantics and long/invalid dates; provide empty and keyboard states. |
| Focus | `/focus` -> choose target -> start -> complete/abandon -> reflect | local active-session recovery, analytics, suggestions | Duplicate completion and multi-tab timers need idempotency. UI and persistence span a 1,364-line page. |
| Library | `/library` -> folders -> note/PDF -> signed upload | upload/loading/errors | Client PDF parsing and signed URL expiry need cancellation/retry; large documents can pressure mobile memory. |
| Review | `/review` -> select source -> generate -> quiz -> attempts | quota/status/generation/errors | Refresh during generation and malformed model output need durable job semantics; page is 2,218 lines. |
| Zen AI | layout action -> chat/stream with references | local thread cache, quota UI, SSE states | 2,519-line view; local private prompt history; cancellation and stale stream ownership require hardening. |
| AI limits | billing/status -> tier limits | multiple quota error variants | Frontend parses inconsistent errors; display exact reset/cost policy from server contract. |
| Billing | Settings -> plans/checkout/refresh/cancel/extend | pending/active/canceled | Never infer entitlement client-side; disable duplicate checkout and explain pending/failed/canceled states. |
| Push | contextual prompt -> permission -> subscribe | dismissed/denied/unsupported handling | Subscription helpers are duplicated/large; ensure one owned subscription per endpoint and safe lock-screen copy. |
| Settings | Settings -> profile/preferences/billing/account | save feedback varies | Account deletion swallows API failure at one call site; require explicit re-auth/recovery and never claim deletion on failure. |
| Offline | navigator event + user-scoped localStorage | top banner; cached state | No conflict/version protocol or durable write queue. Clearly reject risky writes until merge semantics exist. |
| Logout | Settings/layout -> Firebase sign-out | auth gate | Ensure private in-memory/cache data is cleared only for the signed-out user and never another account. |
| Account deletion | Settings -> confirm -> API delete | confirmation | Backend multi-collection delete is not transactional and storage deletion is absent. Partial failure recovery is required. |

For every write phase, tests must cover double click, navigation/unmount, refresh, retry, duplicate request, multi-tab conflict, offline transition, stale deployment tab, and long/invalid input.

## Risk register

| Severity | Risk | Evidence | Treatment |
|---|---|---|---|
| Critical | AI quota may fail open and is non-atomic | backend guard mutates/saves a user document and calls `next()` on guard error | Backend atomic reservation with rollback/finalization; fail closed with a stable error. |
| High | Whole-state last-writer-wins can lose student work | `PUT /api/state`, local cache, debounce/context synchronization | Add revision/ETag conflict detection, compatibility mapper, and conflict UX before offline writes. |
| High | Billing secret/coupon path expands entitlement attack surface | `secret-checkout` and direct-grant configuration exist | Remove direct grants from production; audit webhook signature/idempotency; test server-only entitlement. |
| High | Public page does not communicate product value or trust | browser evidence shows only login | Add accessible progressive landing and persistent auth route. |
| High | Large single chunk and god components hurt mobile reliability | 761.49 kB JS; six files over 900 lines | Route/feature split with performance budget and behavior tests. |
| High | Service-worker/private cache behavior lacks formal policy | custom `public/sw.js`; app state in localStorage | Versioned cache policy, update UX, private-data review, stale-tab tests. |
| Medium | Error contracts and validation are inconsistent | raw `Response` use and handwritten parsing | Typed client, runtime schemas, request IDs, consistent user-safe errors. |
| Medium | Accessibility is not systematically tested | limited component tests; auth password autocomplete warning | Semantic primitives, axe/keyboard/E2E coverage, focus management. |
| Medium | Production dependency advisories | npm install reports 25 vulnerabilities | Review direct/transitive paths; targeted upgrades with build/E2E gates, no force upgrade. |

## Product acceptance

A first-time visitor can understand the product and reach sign-up within one screen. Returning users can resume the last safe context. All pages have loading, empty, success, recoverable error, unauthorized, offline, and mobile states. Important actions remain keyboard/screen-reader operable at 200% zoom and with reduced motion. No UI invents statistics, partners, or testimonials.
