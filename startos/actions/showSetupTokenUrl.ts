import { readSetupState } from '../decrees'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const showSetupTokenUrl = sdk.Action.withoutInput(
  'show-setup-token-url',

  async ({ effects }) => ({
    name: i18n('Show Setup Token URL'),
    description: i18n(
      'Open this URL in a browser to create your CryptPad administrator account. The URL is single-use — once you complete the wizard, it is no longer valid.',
    ),
    warning: null,
    // The decree file only exists after the daemon has run at least once,
    // so the action requires the service to be running.
    allowedStatuses: 'only-running',
    group: null,
    // Hidden — surfaced via the 'setup-token-pending' critical task created
    // by the watcher in init/setup.ts once both URLs are set and the
    // ADD_INSTALL_TOKEN decree has appeared.
    visibility: 'hidden',
  }),

  async ({ effects }) => {
    const state = await readSetupState()
    const mainUrl = await storeJson.read((s) => s.mainUrl).once()

    if (state.kind === 'waiting-for-daemon') {
      throw new Error(
        i18n(
          "The CryptPad daemon hasn't bootstrapped yet. Wait ~30 seconds and retry.",
        ),
      )
    }

    if (state.kind === 'done') {
      throw new Error(
        i18n(
          'Setup is already complete — your administrator account exists. Use the /admin/ panel for further configuration.',
        ),
      )
    }

    // Belt-and-suspenders. mainUrl can't actually be null here because
    // 'only-running' availability + the daemon-start gate in setupMain (which
    // throws if either URL is null — see PLAN §7.4) make this unreachable.
    if (!mainUrl) {
      throw new Error(
        'Main URL is not set; cannot construct setup URL. ' +
          'Run the Set Main URL action and try again.',
      )
    }

    const base = mainUrl.replace(/\/$/, '')
    return {
      version: '1' as const,
      title: i18n('CryptPad Setup URL'),
      message: i18n(
        'Open this URL in a browser to create your administrator account.',
      ),
      result: {
        type: 'single' as const,
        value: `${base}/install/#${state.token}`,
        copyable: true,
        masked: false,
        qr: true,
      },
    }
  },
)
