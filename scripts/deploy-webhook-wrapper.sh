#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${ACADEMIAZEN_APP_ROOT:-/opt/academiazen}"
FRONTEND_REPO="${ACADEMIAZEN_FRONTEND_REPO:-${APP_ROOT}/AcademiaZen}"
APP_USER="${ACADEMIAZEN_APP_USER:-sean}"
INSTALLED_DEPLOYER="/usr/local/libexec/academiazen-deploy-blue-green"

if [[ "${EUID}" -ne 0 ]]; then
  printf '[academiazen-deploy] ERROR: webhook wrapper must run as root\n' >&2
  exit 1
fi

runuser -u "${APP_USER}" -- git -C "${FRONTEND_REPO}" fetch --prune origin main
runuser -u "${APP_USER}" -- git -C "${FRONTEND_REPO}" reset --hard origin/main

install -d -o root -g root -m 0755 "$(dirname "${INSTALLED_DEPLOYER}")"
install -o root -g root -m 0755 \
  "${FRONTEND_REPO}/scripts/deploy-blue-green.sh" \
  "${INSTALLED_DEPLOYER}"

# Replace the legacy app-user-writable root command with a locked bootstrap.
chown root:root "$0"
chmod 0755 "$0"

exec "${INSTALLED_DEPLOYER}"
