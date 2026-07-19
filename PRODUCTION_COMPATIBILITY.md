# Production compatibility

## Repository identity

- Local path: `C:\Users\Sean John Camara\Desktop\AcademiaZen-Root\AcademiaZen`
- Remote: `https://github.com/sean-camara/AcademiaZen`
- Baseline branch/commit: `main` at `f4d0b0a704a54bc422ea031ba03a07d8236845f1`
- Work branch: `modernization/production-v2`
- Baseline working tree: clean; no staged, modified, or untracked user files.

The production VPS currently runs the same baseline commit on `main`. It builds the SPA in Docker and serves it from an Nginx container at loopback `127.0.0.1:5173`; host Nginx terminates TLS and proxies `academiazen.app`.

## Compatibility invariants

- Firebase project/auth configuration and existing user sessions remain valid.
- Existing `ZenState` fields, IDs, ISO/string dates, embedded PDF metadata, reviewer attempts, settings defaults, and localStorage keys remain readable.
- API route, method, auth header, SSE framing, signed-upload, push-subscription, billing, and quota error behavior stays backward-compatible until both repositories deploy together.
- Service-worker updates must not strand clients on mixed old/new assets.
- Frontend must tolerate old backend responses during rollout and backend must tolerate old frontend requests during rollback.

## Release matrix

| Frontend | Backend | Requirement |
|---|---|---|
| old | old | current production |
| new | old | required during frontend-first/rollback window |
| old | new | required during backend-first/rollback window |
| new | new | target |

Use additive API/schema changes first, deploy backend compatibility before consumers, then frontend. Remove compatibility only in a later release after service-worker/asset adoption is measured.

## Known drift

The local root Compose file uses `restart: always` and a health-gated dependency, while production uses `unless-stopped` and a simple dependency. The production Dockerfiles are based on Node 20 while local validation used Node 22. Build and runtime versions must be pinned and tested before release.
