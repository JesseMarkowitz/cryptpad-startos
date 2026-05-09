import { T } from '@start9labs/start-sdk'
import { sdk } from './sdk'
import { UPSTREAM_HTTP_PORT, UPSTREAM_WEBSOCKET_PORT } from './upstream-defaults'

/** CryptPad HTTP server — main app, admin, checkup, sandbox, WebSocket proxy.
 *  Both MultiHost interfaces (ui, sandbox) bind this same port; CryptPad
 *  serves the same content regardless of Host. The browser enforces sandbox
 *  isolation via origin (httpUnsafeOrigin ≠ httpSafeOrigin). */
export const uiPort = UPSTREAM_HTTP_PORT

/** WebSocket server port. Declared for documentation; never bound externally.
 *  Reached only via the internal proxy on uiPort handling /cryptpad_websocket
 *  upgrades — see lib/http-worker.js@v2026.2.2 (server.on 'upgrade' →
 *  wsProxy.upgrade). */
export const wsPort = UPSTREAM_WEBSOCKET_PORT

/** Resolve all non-loopback URLs the user could pick for the main UI. */
export async function getMainUrls(effects: T.Effects): Promise<string[]> {
  return sdk.serviceInterface
    .getOwn(effects, 'ui', (i) => i?.addressInfo?.nonLocal.format() || [])
    .const()
}

/** Resolve all non-loopback URLs the user could pick for the sandbox origin.
 *  The sandbox interface is type 'api' so it does not appear in the StartOS
 *  launcher's clickable list — the only way the user picks its hostname is
 *  through the Set Sandbox URL action (which calls this). */
export async function getSandboxUrls(effects: T.Effects): Promise<string[]> {
  return sdk.serviceInterface
    .getOwn(effects, 'sandbox', (i) => i?.addressInfo?.nonLocal.format() || [])
    .const()
}
