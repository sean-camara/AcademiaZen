# Frontend architecture

## Observed production architecture (2026-07-19)

AcademiaZen is a React 19/Vite 6 single-page PWA. `index.tsx` composes `BrowserRouter`, `App.tsx` owns the authentication gate, and `Layout.tsx` owns authenticated routing. Firebase Auth runs in the browser; bearer tokens are attached in `utils/api.ts`. `ZenContext.tsx` owns most product state, local persistence, backend synchronization, and timer behavior.

```text
Browser
  -> Firebase Auth
  -> App authentication/email-verification gate
  -> ZenContext (tasks, subjects, library, review, chat, settings)
       -> user-scoped localStorage cache
       -> authenticated REST/SSE API
  -> service worker (shell/static caching + push)
```

Major authenticated routes are dashboard `/`, calendar `/calendar`, review `/review`, focus `/focus`, and library `/library`. Zen AI and settings are overlays/views selected through `Layout`, rather than independent URL-addressable routes.

## Structural findings

- `ZenAI.tsx` (2,519 lines), `Review.tsx` (2,218), `Focus.tsx` (1,364), `Settings.tsx` (1,221), `Home.tsx` (1,094), and `ZenContext.tsx` (931) combine unrelated responsibilities.
- All production code is emitted into one 761.49 kB minified JS chunk (193.18 kB gzip).
- Server state, offline cache, timers, mutations, and application state are coupled in one context.
- API results are hand-typed at call sites and error shapes are inconsistent.
- The public route is an authentication form; there is no landing/product route.

## Target boundaries

```text
src/app        composition, router, configuration, global styles
src/features   auth, tasks, calendar, focus, library, review, zen-ai, billing, notifications, settings
src/entities   persisted domain types and compatibility mappers
src/shared     API client, UI primitives, validation, accessibility, utilities
```

Firebase, service-worker messaging, storage, and API transport belong behind focused adapters. Backend state moves to query/mutation hooks; ephemeral state stays local. Persisted data is decoded and migrated at boundaries. Routes are lazy chunks with error boundaries. Marketing/3D code is a separately loaded public-only chunk.

## Decisions

- Retain the React SPA/PWA; no observed requirement justifies Next.js.
- Preserve the current REST API while introducing backend-owned runtime schemas and generated contracts incrementally.
- Split by user workflow, not by arbitrary technical layers.
- Introduce dependencies only when a phase uses them and has tests.
