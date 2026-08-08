import { T } from '@start9labs/start-sdk'
import { sdk } from './sdk'
import { UPSTREAM_HTTP_PORT } from './upstream-defaults'

/** CryptPad HTTP server — main app, admin, checkup, sandbox, WebSocket proxy.
 *  Both MultiHost interfaces (ui, sandbox) bind this same port; CryptPad
 *  serves the same content regardless of Host. The browser enforces sandbox
 *  isolation via origin (httpUnsafeOrigin ≠ httpSafeOrigin). */
export const uiPort = UPSTREAM_HTTP_PORT

/**
 * Resolve the non-loopback URLs the user could pick for one of our interfaces.
 *
 * Note the two-id distinction, which is easy to get wrong and fails silently:
 *   - `hostId` is what was passed to `sdk.MultiHost.of` in interfaces.ts
 *     ('ui-multi' / 'sandbox-multi').
 *   - `interfaceId` is the interface's own id ('ui' / 'sandbox').
 * Passing an interface id as the host id resolves a host that doesn't exist,
 * which yields an empty URL list rather than an error — the action's dropdown
 * just comes up blank.
 *
 * As of start-sdk 2.0 a service interface lives on the binding that exported
 * it (`host.bindings[<internalPort>].interfaces[<id>]`) rather than as a flat
 * entry on the package, and `sdk.serviceInterface.getOwn` is gone. The
 * addressInfo comes back pre-filled, so `.nonLocal.format()` still applies
 * directly. The `map` selector keeps `.const()` reactive to only this
 * interface's addresses rather than to any change on the whole host.
 */
function getInterfaceUrls(
  effects: T.Effects,
  hostId: string,
  interfaceId: string,
): Promise<string[]> {
  return sdk.host
    .getOwn(
      effects,
      hostId,
      (h) => h?.bindings[uiPort]?.interfaces[interfaceId],
    )
    .const()
    .then((i) => i?.addressInfo?.nonLocal.format() || [])
}

/** Resolve all non-loopback URLs the user could pick for the main UI. */
export async function getMainUrls(effects: T.Effects): Promise<string[]> {
  return getInterfaceUrls(effects, 'ui-multi', 'ui')
}

/** Resolve all non-loopback URLs the user could pick for the sandbox origin.
 *  The sandbox interface is type 'api' so it does not appear in the StartOS
 *  launcher's clickable list — the only way the user picks its hostname is
 *  through the Set Sandbox URL action (which calls this). */
export async function getSandboxUrls(effects: T.Effects): Promise<string[]> {
  return getInterfaceUrls(effects, 'sandbox-multi', 'sandbox')
}
