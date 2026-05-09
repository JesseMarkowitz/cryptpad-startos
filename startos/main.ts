import { i18n } from './i18n'
import { sdk } from './sdk'
import { uiPort } from './utils'

/**
 * NOTE: This is a placeholder skeleton kept compileable during the foundation
 * commit. The full setupMain — config.js generation, mounts, daemon-start
 * gate — lands in the dedicated "Main" commit (PLAN §8). Until then, the
 * service still starts using the upstream image's defaults so each commit
 * leaves a buildable state.
 */
export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting CryptPad'))

  return sdk.Daemons.of(effects).addDaemon('primary', {
    subcontainer: await sdk.SubContainer.of(
      effects,
      { imageId: 'cryptpad' },
      sdk.Mounts.of().mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: '/data',
        readonly: false,
      }),
      'cryptpad-sub',
    ),
    exec: { command: sdk.useEntrypoint() },
    ready: {
      display: i18n('Web Interface'),
      fn: () =>
        sdk.healthCheck.checkPortListening(effects, uiPort, {
          successMessage: i18n('CryptPad is ready'),
          errorMessage: i18n('CryptPad is not ready'),
        }),
    },
    requires: [],
  })
})
