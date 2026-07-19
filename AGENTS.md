# AcademiaZen frontend working agreement

This repository is the production frontend for `academiazen.app`. Preserve Firebase identities, API compatibility, local work, PWA update behavior, and all student data workflows.

## Safety

- Work on `modernization/production-v2`, never directly on `main`.
- Never commit `.env`, `.env.local`, credentials, auth tokens, signed URLs, or captured private study data.
- Do not change billing, quota, persistence, or offline semantics without compatibility tests and an explicit migration/rollback note.
- Treat `ZenState` as a persisted contract. Additive, backward-compatible changes come before removals or renames.
- Do not cache authenticated API responses in the service worker unless a reviewed per-user policy exists.
- Do not deploy automatically. Production release requires backend compatibility, backup evidence, health checks, smoke tests, and rollback commands.

## Quality gate

Run `npm ci`, tests, strict type checking, lint/format checks once configured, and `npm run build`. Test 360, 390, 768, 1024, 1440, and 1920 px; keyboard use; 200% zoom; reduced motion; offline/reconnect; empty and large data; expired auth; duplicate submissions; and slow/failed requests.

Prefer feature boundaries, typed API adapters, semantic HTML, visible focus, route-level lazy loading, and small focused components. Avoid new global contexts, raw `fetch` in views, fake product claims, dead controls, and decorative motion that impairs use.
