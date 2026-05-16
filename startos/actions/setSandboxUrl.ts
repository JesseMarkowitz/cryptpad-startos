import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { getSandboxUrls } from '../utils'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  url: Value.dynamicSelect(async ({ effects }) => {
    const urls = await getSandboxUrls(effects)
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

// Mirror of setMainUrl but bound to the 'sandbox' interface and the
// store.sandboxUrl field. This is the ONLY mechanism the user has to choose
// the sandbox URL — the sandbox interface is type 'api' (see interfaces.ts)
// and therefore not clickable in the StartOS launcher.
export const setSandboxUrl = sdk.Action.withInput(
  'set-sandbox-url',

  async ({ effects }) => ({
    name: i18n('Set Sandbox URL'),
    description: i18n(
      'Choose which URL CryptPad should use as its sandbox iframe origin. This must be a different hostname from the Main URL — the browser uses the origin difference to enforce sandbox isolation around document rendering.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => ({
    url: (await storeJson.read((s) => s.sandboxUrl).once()) || undefined,
  }),

  // Cross-origin guard: refuse to save if the user picked the same hostname
  // as the current mainUrl. Same check exists in setupMain as a backstop;
  // catching it here gives the user the error at submit time rather than
  // five minutes later when the daemon fails to start.
  async ({ effects, input }) => {
    const currentMain = await storeJson.read((s) => s.mainUrl).once()
    if (
      currentMain &&
      new URL(input.url).origin === new URL(currentMain).origin
    ) {
      throw new Error(
        i18n(
          'Main URL and Sandbox URL must use different hostnames so the browser can enforce sandbox isolation. Pick a different one.',
        ),
      )
    }
    await storeJson.merge(effects, { sandboxUrl: input.url })
  },
)
