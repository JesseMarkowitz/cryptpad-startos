import { i18n } from './i18n'
import { sdk } from './sdk'
import { uiPort } from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  // Two MultiHost bindings, BOTH targeting container port `uiPort` (3000).
  //
  // Why "two MultiHosts on the same container port" works:
  //   CryptPad's browser sandbox model requires httpUnsafeOrigin ≠
  //   httpSafeOrigin — the sandbox iframe must load from a different ORIGIN
  //   so the browser's same-origin policy isolates it from the main app.
  //
  //   StartOS gives each MultiHost a distinct hostname. Both bindings target
  //   port 3000 inside the container; CryptPad's HTTP server serves the same
  //   content regardless of Host header (CSP differentiation is by URL path,
  //   not host — verified in lib/http-worker.js@2026.5.1 setHeaders). The
  //   browser is what enforces the sandbox boundary via origin.
  //
  // Why the sandbox interface is type 'api' (not 'ui'):
  //   It is internal iframe machinery, loaded automatically by the main UI;
  //   a user who opens it directly just gets a confusing broken page.
  //
  //   Be precise about what 'api' actually buys, because the guide is emphatic
  //   that `type` is "a label, not a control" (interfaces.md) and that is
  //   *almost* true here. The one place it is load-bearing is the service
  //   page's launch control, which filters on `i.type === 'ui'`
  //   (start-os/web/ui/.../services/components/controls.component.ts) — so the
  //   sandbox never appears as an "Open" button. It does NOT hide the
  //   interface: the Interfaces tab lists every interface and links its
  //   addresses regardless of type, so the sandbox is still visible and
  //   clickable there. Confirmed by observation in v1 testing (checklist #18).
  //
  //   Reference precedent: garage-startos/startos/interfaces.ts uses 'api' on
  //   its non-user-facing bindings for the same reason.
  //
  // WebSocket: CryptPad's HTTP server on uiPort intercepts upgrade requests
  // for /cryptpad_websocket and proxies them internally to wsPort 3003
  // (lib/http-worker.js@2026.5.1: server.on('upgrade', wsProxy.upgrade)).
  // We never bind 3003 externally — see utils.ts wsPort comment.
  const uiMulti = sdk.MultiHost.of(effects, 'ui-multi')
  const sandboxMulti = sdk.MultiHost.of(effects, 'sandbox-multi')

  const uiOrigin = await uiMulti.bindPort(uiPort, { protocol: 'http' })
  const sandboxOrigin = await sandboxMulti.bindPort(uiPort, {
    protocol: 'http',
  })

  const ui = sdk.createInterface(effects, {
    name: i18n('Web UI'),
    id: 'ui',
    description: i18n('The CryptPad collaborative editor'),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  const sandbox = sdk.createInterface(effects, {
    name: i18n('Sandbox Origin'),
    id: 'sandbox',
    description: i18n(
      "Internal iframe origin for CryptPad's document sandbox. Loaded automatically by the main UI; not a user destination. Required separately so the browser sees a different origin and can enforce sandbox isolation via the same-origin policy.",
    ),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  return [await uiOrigin.export([ui]), await sandboxOrigin.export([sandbox])]
})
