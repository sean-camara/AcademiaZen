#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${ACADEMIAZEN_APP_ROOT:-/opt/academiazen}"
FRONTEND_REPO="${ACADEMIAZEN_FRONTEND_REPO:-${APP_ROOT}/AcademiaZen}"
APP_USER="${ACADEMIAZEN_APP_USER:-sean}"
SITE_CONFIG="${ACADEMIAZEN_SITE_CONFIG:-/etc/nginx/sites-available/academiazen}"
UPSTREAM_CONFIG="${ACADEMIAZEN_UPSTREAM_CONFIG:-/etc/nginx/conf.d/academiazen-frontend-upstream.conf}"
STATE_DIR="${ACADEMIAZEN_STATE_DIR:-/var/lib/academiazen}"
STATE_FILE="${STATE_DIR}/frontend-active.env"
LOCK_FILE="${ACADEMIAZEN_DEPLOY_LOCK:-/tmp/deploy.lock}"
LOG_DIR="${ACADEMIAZEN_LOG_DIR:-/var/log/academiazen}"
LOG_FILE="${LOG_DIR}/frontend-deploy.log"

log() {
  printf '[academiazen-deploy] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

[[ "${EUID}" -eq 0 ]] || fail "deployment must run as root (the webhook service supplies this)"

install -d -o root -g root -m 0755 "${LOG_DIR}"
touch "${LOG_FILE}"
chmod 0644 "${LOG_FILE}"
exec > >(tee -a "${LOG_FILE}") 2>&1
trap 'exit_code=$?; log "FAILED at line ${LINENO}: ${BASH_COMMAND} (exit ${exit_code})"' ERR
log "starting deployment requested at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

exec 9>"${LOCK_FILE}"
flock -n 9 || fail "another deployment is already running"

command -v docker >/dev/null || fail "docker is not installed"
command -v nginx >/dev/null || fail "nginx is not installed"
command -v runuser >/dev/null || fail "runuser is not installed"
[[ -d "${FRONTEND_REPO}/.git" ]] || fail "frontend repository not found at ${FRONTEND_REPO}"
[[ -f "${SITE_CONFIG}" ]] || fail "Nginx site config not found at ${SITE_CONFIG}"
if [[ -f "${APP_ROOT}/docker-compose.yml" ]]; then
  COMPOSE_FILE="${APP_ROOT}/docker-compose.yml"
elif [[ -f "${APP_ROOT}/docker-compose.yaml" ]]; then
  COMPOSE_FILE="${APP_ROOT}/docker-compose.yaml"
else
  fail "compose file not found in ${APP_ROOT}"
fi

log "syncing production checkout with origin/main"
runuser -u "${APP_USER}" -- git -C "${FRONTEND_REPO}" fetch --prune origin main
runuser -u "${APP_USER}" -- git -C "${FRONTEND_REPO}" reset --hard origin/main
release_sha="$(runuser -u "${APP_USER}" -- git -C "${FRONTEND_REPO}" rev-parse HEAD)"

if [[ -f "${STATE_FILE}" ]] && grep -q "^RELEASE_SHA=${release_sha}$" "${STATE_FILE}"; then
  active_port="$(sed -n 's/^ACTIVE_PORT=//p' "${STATE_FILE}" | head -n 1)"
  if [[ "${active_port}" =~ ^517[34]$ ]] && curl -fsS --max-time 3 "http://127.0.0.1:${active_port}/healthz" >/dev/null; then
    log "release ${release_sha} is already healthy on port ${active_port}; nothing to do"
    exit 0
  fi
fi

active_port=""
if [[ -f "${UPSTREAM_CONFIG}" ]]; then
  active_port="$(sed -nE 's/^[[:space:]]*server[[:space:]]+127\.0\.0\.1:(5173|5174).*/\1/p' "${UPSTREAM_CONFIG}" | head -n 1)"
fi
if [[ -z "${active_port}" ]]; then
  active_port="$(sed -nE 's/.*proxy_pass[[:space:]]+http:\/\/127\.0\.0\.1:(5173|5174);.*/\1/p' "${SITE_CONFIG}" | head -n 1)"
fi
[[ "${active_port}" =~ ^517[34]$ ]] || fail "could not determine the active frontend port"

if [[ "${active_port}" == "5173" ]]; then
  target_port="5174"
  target_slot="green"
else
  target_port="5173"
  target_slot="blue"
fi
target_container="academiazen-web-${target_slot}"
release_tag="academiazen-web:${release_sha}"

log "building release ${release_sha} for inactive ${target_slot} slot"
docker compose --project-directory "${APP_ROOT}" -f "${COMPOSE_FILE}" build web
image_id="$(docker compose --project-directory "${APP_ROOT}" -f "${COMPOSE_FILE}" images -q web | head -n 1)"
[[ -n "${image_id}" ]] || fail "compose build did not produce a frontend image"
docker image tag "${image_id}" "${release_tag}"
backend_container="$(docker compose --project-directory "${APP_ROOT}" -f "${COMPOSE_FILE}" ps -q backend | head -n 1)"
[[ -n "${backend_container}" ]] || fail "backend container is not running"
app_network="$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "${backend_container}" | head -n 1)"
[[ -n "${app_network}" ]] || fail "could not determine the application Docker network"

log "clearing inactive port ${target_port}"
while IFS= read -r stale_container; do
  [[ -n "${stale_container}" ]] && docker rm -f "${stale_container}" >/dev/null
done < <(docker ps -aq --filter "publish=${target_port}")
docker rm -f "${target_container}" >/dev/null 2>&1 || true

log "starting ${target_slot} slot on 127.0.0.1:${target_port}"
docker run --detach \
  --name "${target_container}" \
  --restart unless-stopped \
  --label "app=academiazen" \
  --label "component=frontend" \
  --label "slot=${target_slot}" \
  --label "release=${release_sha}" \
  --network "${app_network}" \
  --publish "127.0.0.1:${target_port}:80" \
  "${release_tag}" >/dev/null

healthy=false
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://127.0.0.1:${target_port}/healthz" >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done
if [[ "${healthy}" != "true" ]]; then
  docker logs --tail 100 "${target_container}" || true
  docker rm -f "${target_container}" >/dev/null 2>&1 || true
  fail "inactive ${target_slot} slot did not become healthy"
fi

site_backup="$(mktemp)"
upstream_backup="$(mktemp)"
site_candidate="$(mktemp)"
upstream_candidate="$(mktemp)"
had_upstream=false
cp "${SITE_CONFIG}" "${site_backup}"
if [[ -f "${UPSTREAM_CONFIG}" ]]; then
  cp "${UPSTREAM_CONFIG}" "${upstream_backup}"
  had_upstream=true
fi

cleanup() {
  rm -f "${site_backup}" "${upstream_backup}" "${site_candidate}" "${upstream_candidate}"
}
trap cleanup EXIT

rollback_proxy() {
  log "rolling Nginx back to port ${active_port}"
  install -m 0644 "${site_backup}" "${SITE_CONFIG}"
  if [[ "${had_upstream}" == "true" ]]; then
    install -m 0644 "${upstream_backup}" "${UPSTREAM_CONFIG}"
  else
    rm -f "${UPSTREAM_CONFIG}"
  fi
  nginx -t && systemctl reload nginx
}

if grep -q 'proxy_pass http://academiazen_frontend;' "${SITE_CONFIG}"; then
  cp "${SITE_CONFIG}" "${site_candidate}"
else
  sed -E '0,/proxy_pass[[:space:]]+http:\/\/127\.0\.0\.1:517[34];/s//proxy_pass http:\/\/academiazen_frontend;/' \
    "${SITE_CONFIG}" > "${site_candidate}"
fi
grep -q 'proxy_pass http://academiazen_frontend;' "${site_candidate}" || fail "could not prepare the Nginx frontend proxy"

printf 'upstream academiazen_frontend {\n    server 127.0.0.1:%s max_fails=3 fail_timeout=5s;\n    keepalive 16;\n}\n' \
  "${target_port}" > "${upstream_candidate}"

log "switching production traffic from ${active_port} to ${target_port}"
install -m 0644 "${site_candidate}" "${SITE_CONFIG}"
install -m 0644 "${upstream_candidate}" "${UPSTREAM_CONFIG}"
if ! nginx -t; then
  rollback_proxy
  fail "Nginx rejected the new upstream"
fi
if ! systemctl reload nginx; then
  rollback_proxy
  fail "Nginx reload failed"
fi

if ! curl -fsS --retry 5 --retry-delay 1 --max-time 5 \
  --resolve www.academiazen.app:443:127.0.0.1 \
  https://www.academiazen.app/healthz >/dev/null; then
  rollback_proxy
  fail "public smoke test failed after the traffic switch"
fi

install -d -m 0755 "${STATE_DIR}"
state_candidate="$(mktemp)"
printf 'RELEASE_SHA=%s\nACTIVE_SLOT=%s\nACTIVE_PORT=%s\nACTIVE_CONTAINER=%s\nDEPLOYED_AT=%s\n' \
  "${release_sha}" "${target_slot}" "${target_port}" "${target_container}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "${state_candidate}"
install -m 0644 "${state_candidate}" "${STATE_FILE}"
rm -f "${state_candidate}"

log "release ${release_sha} is live on ${target_slot} (${target_port}); previous slot remains available for rollback"
