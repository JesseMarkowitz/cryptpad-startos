import { i18n } from './i18n'
import { sdk } from './sdk'
import { uiPort } from './utils'

/**
 * NOTE: This is a placeholder kept compileable during the foundation commit.
 * The full two-MultiHost design (ui + sandbox, both binding port 3000, sandbox
 * with type 'api') lands in the dedicated "Interfaces" commit (PLAN §5).
 */
export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const uiMulti = sdk.MultiHost.of(effects, 'ui-multi')
  const uiMultiOrigin = await uiMulti.bindPort(uiPort, { protocol: 'http' })
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

  return [await uiMultiOrigin.export([ui])]
})
