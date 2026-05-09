# DO NOT add nginx / Caddy / Traefik or any other reverse proxy to this image.
# CryptPad's Node server already serves the correct CSP / COEP / CORP headers
# for the /checkup/ self-test (see lib/http-worker.js@v2026.2.2 setHeaders);
# an in-container proxy duplicates them and breaks browser security checks.
# StartOS terminates TLS at the platform layer — there is nothing for an
# in-container proxy to do.
#
# CryptPad's HTTP server on port 3000 internally proxies /cryptpad_websocket
# to its own WebSocket server on port 3003 (lib/http-worker.js@v2026.2.2:
# server.on('upgrade', wsProxy.upgrade)). Port 3003 must NEVER be bound
# externally — declared in upstream-defaults.ts as documentation only.

FROM cryptpad/cryptpad:version-2026.2.2

# Bake OnlyOffice (Document / Sheet / Presentation editors) into the image
# at build time so users don't pay a 10–15 minute first-start download.
#
# install-onlyoffice.sh writes to TWO paths:
#   - /cryptpad/www/common/onlyoffice/dist/   ← per-version assets, image rootfs
#   - /cryptpad/onlyoffice-conf/              ← state, MUST be a volume mount
#
# Only `dist/` is baked here. `onlyoffice-conf/` is mounted from the StartOS
# main volume at runtime (see startos/main.ts mountVolume); the install
# script idempotently re-checks state on subsequent runs against the
# onlyoffice.properties file in conf/.
#
# Flags (verified against install-onlyoffice.sh@v2026.2.2):
#   --accept-license     — bypass the interactive license review
#   --trust-repository   — git safe.directory for the cloned onlyoffice-builds
#                          repo (the build runs as root which mismatches the
#                          UID gitconfig would otherwise want)
#
# Build-time network deps: github.com (clones cryptpad/onlyoffice-builds
# and the onlyoffice-editor / onlyoffice-x2t-wasm release archives), plus
# raw.githubusercontent.com for the (license-header) curl. Documented in
# README "Building from Source".
USER root
RUN ./install-onlyoffice.sh --accept-license --trust-repository

# Restore the unprivileged runtime user (UID/GID 4001) the upstream
# Dockerfile sets via `USER cryptpad`. CryptPad MUST run as 4001 — that's
# what the volume's data files are owned by (see startos/main.ts ensureDir
# + chown).
USER cryptpad
