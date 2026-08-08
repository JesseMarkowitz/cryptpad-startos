import { readSetupState } from '../decrees'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const showSetupTokenUrl = sdk.Action.withoutInput(
  'show-setup-token-url',

  async ({ effects }) => ({
    name: i18n('Complete CryptPad Initial Setup'),
    description: i18n(
      'Open this URL in a browser to create your CryptPad administrator account. The URL is single-use — once you complete the wizard, it is no longer valid.',
    ),
    warning: null,
    // 'any' — readable while the service is stopped. The action handler
    // reads the decree log from the volume (sdk.volumes.main.subpath),
    // which is accessible to the StartOS service-runtime regardless of
    // whether the cryptpad container is running. If the daemon has never
    // run, readSetupState() returns 'waiting-for-daemon' and the handler
    // throws a clear "wait ~30 seconds and retry" message.
    //
    // 'only-running' would be wrong: combined with a sticky 'critical'
    // setup-token task (the bug this fix removes) it produced an
    // unrecoverable startup deadlock — the user couldn't start the service
    // because of the task, and couldn't run the action because the service
    // was stopped.
    allowedStatuses: 'any',
    group: null,
    // Hidden — surfaced via the 'setup-token-pending' important task
    // created by the watcher in init/setup.ts once both URLs are set and
    // the ADD_INSTALL_TOKEN decree has appeared.
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

    // mainUrl can be null in one situation: the user has never set it
    // (fresh install, before completing Set Main URL). In that case the
    // setup-token-pending task wouldn't exist either (the watcher only
    // creates it once both URLs are set), so the action's only entry
    // point is the user opening the hidden action directly — defensive
    // path that returns a clear error rather than a malformed URL.
    if (!mainUrl) {
      throw new Error(
        i18n(
          'Main URL is not set; cannot construct setup URL. Run the Set Main URL action and try again.',
        ),
      )
    }

    const base = mainUrl.replace(/\/$/, '')
    return {
      version: '1' as const,
      title: i18n('CryptPad Setup URL'),
      message: i18n(
        'Open this URL in a browser to create your administrator account.',
      ),
      // Masked, and deliberately no QR. This URL is a credential: whoever
      // holds it creates the first administrator on an instance that has
      // none. The fleet convention for credentials (actions.md,
      // recipe-admin-credentials.md) is masked + copyable — masking hides the
      // value from shoulder-surfing and screen shares without breaking the
      // copy path. The QR is dropped rather than kept because rendering the
      // same secret as a scannable image would defeat masking the text.
      result: {
        type: 'single' as const,
        value: `${base}/install/#${state.token}`,
        copyable: true,
        masked: true,
        qr: false,
      },
    }
  },
)
