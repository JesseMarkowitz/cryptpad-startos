import { setMainUrl } from '../actions/setMainUrl'
import { setSandboxUrl } from '../actions/setSandboxUrl'
import { showSetupTokenUrl } from '../actions/showSetupTokenUrl'
import { readSetupState } from '../decrees'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { getMainUrls, getSandboxUrls } from '../utils'

/**
 * Reactive watcher — runs on every init kind (no `kind` guard) and re-runs
 * whenever any of its `.const(effects)` reads change.
 *
 * Job: keep three critical tasks in sync with the world's state:
 *
 *   1. main-url-not-set / main-url-unavailable — fires until the user
 *      picks a Main URL that's currently reachable.
 *   2. sandbox-url-not-set / sandbox-url-unavailable — same shape for
 *      sandbox.
 *   3. setup-token-pending — fires once both URLs are set AND the daemon
 *      has emitted ADD_INSTALL_TOKEN; clears once the wizard is complete
 *      (decree consumed).
 *
 * Each task is 'critical' severity — per tasks.md, critical tasks BLOCK
 * the service from starting until the user completes them. That's the
 * daemon-start gate: with no Main URL or no Sandbox URL set, setupMain is
 * never invoked.
 *
 * Modelled on vaultwarden-startos/startos/init/setup.ts and
 * ghost-startos/startos/init/taskSetPrimaryUrl.ts. Differences:
 *
 *   - No auto-default — the brief's locked decision #12 says do NOT
 *     auto-pick a .local URL when none is set. Auto-defaulting silently
 *     breaks Tor/clearnet-only users whose service starts on a hostname
 *     they can't reach.
 *   - Two URLs to track instead of one.
 *   - Third task layered on top of the URL gate.
 */
export const setup = sdk.setupOnInit(async (effects) => {
  const [mainUrls, sandboxUrls, store] = await Promise.all([
    getMainUrls(effects),
    getSandboxUrls(effects),
    storeJson
      .read((s) => ({ mainUrl: s.mainUrl, sandboxUrl: s.sandboxUrl }))
      .const(effects),
  ])

  // ── Main URL ──────────────────────────────────────────────────────
  if (!store?.mainUrl) {
    await sdk.action.createOwnTask(effects, setMainUrl, 'critical', {
      replayId: 'main-url-not-set',
      reason: i18n('Choose the primary domain for the CryptPad UI.'),
    })
    await sdk.action.clearTask(effects, 'main-url-unavailable')
  } else if (!mainUrls.includes(store.mainUrl)) {
    await sdk.action.createOwnTask(effects, setMainUrl, 'critical', {
      replayId: 'main-url-unavailable',
      reason: i18n(
        'Your previously selected Main URL is no longer available. Pick a new one.',
      ),
    })
    await sdk.action.clearTask(effects, 'main-url-not-set')
  } else {
    await sdk.action.clearTask(effects, 'main-url-not-set')
    await sdk.action.clearTask(effects, 'main-url-unavailable')
  }

  // ── Sandbox URL ───────────────────────────────────────────────────
  if (!store?.sandboxUrl) {
    await sdk.action.createOwnTask(effects, setSandboxUrl, 'critical', {
      replayId: 'sandbox-url-not-set',
      reason: i18n(
        "Choose the sandbox domain for CryptPad's document iframe isolation.",
      ),
    })
    await sdk.action.clearTask(effects, 'sandbox-url-unavailable')
  } else if (!sandboxUrls.includes(store.sandboxUrl)) {
    await sdk.action.createOwnTask(effects, setSandboxUrl, 'critical', {
      replayId: 'sandbox-url-unavailable',
      reason: i18n(
        'Your previously selected Sandbox URL is no longer available. Pick a new one.',
      ),
    })
    await sdk.action.clearTask(effects, 'sandbox-url-not-set')
  } else {
    await sdk.action.clearTask(effects, 'sandbox-url-not-set')
    await sdk.action.clearTask(effects, 'sandbox-url-unavailable')
  }

  // ── Setup-token follow-up ─────────────────────────────────────────
  // Only after both URLs are set do we even check the decree log. The
  // decree file doesn't exist until the daemon has run, so before then
  // readSetupState() reports 'waiting-for-daemon' and we don't surface
  // a task — the user just sees the daemon starting up.
  if (store?.mainUrl && store?.sandboxUrl) {
    const state = await readSetupState()
    if (state.kind === 'pending') {
      await sdk.action.createOwnTask(effects, showSetupTokenUrl, 'critical', {
        replayId: 'setup-token-pending',
        reason: i18n(
          'Open this URL once and complete the wizard to create your CryptPad administrator account.',
        ),
      })
    } else {
      await sdk.action.clearTask(effects, 'setup-token-pending')
    }
  }
})
