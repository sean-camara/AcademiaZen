# Frontend security

## Trust boundaries

The browser is untrusted. Firebase ID tokens authenticate API calls, but UID, email, role, tier, prices, limits, upload keys, and entitlement displayed by the client are never authoritative. All sensitive decisions remain server-side.

## Observed controls

- Firebase SDK authentication with server bearer tokens.
- User-scoped local state cache and signed R2 upload/download requests.
- No production secret files are tracked; `.env.local` is ignored.
- Production frontend and backend ports are loopback-bound behind Nginx/TLS.

## Findings

- `utils/api.ts` uses `(import.meta as any)` and returns raw responses, weakening environment and error validation.
- Private study state/chat may persist in localStorage; XSS or a shared device can expose it.
- Service-worker caching and update policy require explicit review to avoid stale/private data retention.
- Account-deletion UI contains a swallowed API error path.
- No documented Content Security Policy is visible in public response headers.
- Client error handling can surface provider/backend message strings inconsistently.

## Requirements

Validate public environment values at boot without logging them. Use a typed API error envelope with request IDs. Never log tokens, signed URLs, full prompts, or private documents. Minimize local private-data retention, namespace it by UID, clear it on account deletion/sign-out according to policy, and never share cache across accounts. Sanitize/escape all rendered model/document content. Add CSP after inventorying Firebase, API, font, image, worker, and optional 3D origins; deploy first in report-only mode.

Report suspected vulnerabilities privately to the repository owner; do not put secrets or exploit payloads in issues.
