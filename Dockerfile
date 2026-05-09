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

# The build-pipeline commit (PLAN §10) adds an OnlyOffice install layer here:
#
#   USER root
#   RUN ./install-onlyoffice.sh --accept-license --trust-repository
#   USER cryptpad
#
# This placeholder Dockerfile inherits the upstream image unchanged so each
# commit leaves the package buildable. Without OnlyOffice baked in, the
# Document / Sheet / Presentation editors are unavailable until the
# build-pipeline commit lands.
