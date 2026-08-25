# Frontend blue/green deployment

Production frontend releases are triggered by the authenticated GitHub webhook whenever `main` changes.

## Release flow

1. Synchronize `/opt/academiazen/AcademiaZen` with `origin/main`.
2. Build the new frontend image without touching live traffic.
3. Start the inactive slot on port `5173` (blue) or `5174` (green).
4. Wait for the new slot's `/healthz` endpoint to return `200`.
5. Validate the Nginx configuration and gracefully reload it onto the new slot.
6. Run a TLS smoke test through the production virtual host.
7. Keep the previous slot running for immediate rollback.

Deployments are serialized with `/tmp/deploy.lock`. A failed build or health check never changes live traffic. A failed Nginx switch restores the previous configuration.

## State and diagnostics

```bash
cat /var/lib/academiazen/frontend-active.env
docker ps --filter label=component=frontend
journalctl -u webhook --since "30 minutes ago"
tail -n 200 /var/log/academiazen/frontend-deploy.log
curl -fsS https://www.academiazen.app/healthz
```

## Manual rollback

Read `ACTIVE_PORT` from `/var/lib/academiazen/frontend-active.env`, select the other healthy port, update `/etc/nginx/conf.d/academiazen-frontend-upstream.conf`, run `nginx -t`, and gracefully reload Nginx. Do not stop the active slot before the reload succeeds.

## GitHub Actions note

The repository CI remains the code-quality workflow. If GitHub blocks hosted jobs because of an account-level billing lock, the authenticated webhook still deploys `main`; the server-side build, inactive-slot health check, Nginx validation, and production smoke test remain enforced.
