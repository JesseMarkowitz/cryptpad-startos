/**
 * Constants extracted from upstream's config/config.example.js at tag v2026.2.2.
 * Re-verify if you bump CryptPad version:
 *   https://github.com/cryptpad/cryptpad/blob/v2026.2.2/config/config.example.js
 *
 * The point of this file is to make every "magic number" in the wrapper
 * traceable to a specific upstream commit so a future maintainer can grep for
 * the constant name and find both the StartOS-side use and the upstream source.
 */

/** httpPort — main HTTP listener; the StartOS edge proxy targets this. */
export const UPSTREAM_HTTP_PORT = 3000 as const

/** httpSafePort — upstream's dev-only fallback for serving sandbox content
 *  on a second port when only one domain is available. We have two real
 *  domains via two MultiHosts on different hostnames, so this port is never
 *  reached externally. Documented here for grep-ability. */
export const UPSTREAM_HTTP_SAFE_PORT = 3001 as const

/** websocketPort — CryptPad's HTTP server on uiPort intercepts upgrade
 *  requests for /cryptpad_websocket and proxies them internally to this
 *  port (lib/http-worker.js@v2026.2.2: server.on('upgrade', wsProxy.upgrade)).
 *  Declared for documentation; never bound externally. */
export const UPSTREAM_WEBSOCKET_PORT = 3003 as const

/** Upstream's docker-entrypoint.sh sets installMethod via sed when generating
 *  config.js from scratch. We bypass the entrypoint's auto-generation branch
 *  via CPAD_CONF, so we must preserve this value ourselves in the generated
 *  config (CryptPad's telemetry uses it). */
export const UPSTREAM_INSTALL_METHOD = 'docker' as const

/** Upstream's docker-entrypoint.sh sets httpAddress via sed when generating
 *  config.js from scratch. Same preservation reason as installMethod. */
export const UPSTREAM_HTTP_ADDRESS = '0.0.0.0' as const
