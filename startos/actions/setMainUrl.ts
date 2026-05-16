import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { getMainUrls } from '../utils'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  url: Value.dynamicSelect(async ({ effects }) => {
    const urls = await getMainUrls(effects)
    return {
      name: i18n('URL'),
      values: urls.reduce(
        (obj, url) => ({ ...obj, [url]: url }),
        {} as Record<string, string>,
      ),
      default: '',
    }
  }),
})

export const setMainUrl = sdk.Action.withInput(
  'set-main-url',

  async ({ effects }) => ({
    name: i18n('Set Main URL'),
    description: i18n(
      "Choose which URL CryptPad should serve as its main app. This is the URL users open in their browser. CryptPad will not start until both Main URL and Sandbox URL are set.",
    ),
    warning: null,
    // 'any' so the user can re-run later to switch the main URL after the
    // service is running. Initial gating comes from the 'critical' task in
    // init/setup.ts, not from this action's availability.
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => ({
    url: (await storeJson.read((s) => s.mainUrl).once()) || undefined,
  }),

  // The reactive watcher in init/setup.ts notices the store change and clears
  // the 'main-url-not-set' / 'main-url-unavailable' tasks; setupMain re-reads
  // the store via .const() and restarts the daemon with the new URL.
  //
  // Cross-origin guard: refuse to save if the user picked the same hostname
  // as the current sandboxUrl. Same check exists in setupMain as a backstop;
  // catching it here gives the user the error at submit time rather than
  // five minutes later when the daemon fails to start.
  async ({ effects, input }) => {
    const currentSandbox = await storeJson.read((s) => s.sandboxUrl).once()
    if (
      currentSandbox &&
      new URL(input.url).origin === new URL(currentSandbox).origin
    ) {
      throw new Error(
        i18n(
          'Main URL and Sandbox URL must use different hostnames so the browser can enforce sandbox isolation. Pick a different one.',
        ),
      )
    }
    await storeJson.merge(effects, { mainUrl: input.url })
  },
)
