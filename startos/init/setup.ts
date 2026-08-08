import { setMainUrl } from '../actions/setMainUrl'
import { setSandboxUrl } from '../actions/setSandboxUrl'
import { showSetupTokenUrl } from '../actions/showSetupTokenUrl'
import { decreeLog } from '../fileModels/decreeLog'
import { parseSetupState } from '../setupState'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { getMainUrls, getSandboxUrls } from '../utils'

/**
 * Reactive watcher — runs on every init kind (no `kind` guard) and re-runs
 * whenever any of its `.const(effects)` reads change.
 *
 * Job: keep three tasks in sync with the world's state:
 *
 *   1. main-url-not-set / main-url-unavailable — 'critical'.
 *      Fires until the user picks a Main URL that's currently reachable.
 *   2. sandbox-url-not-set / sandbox-url-unavailable — 'critical'.
 *      Same shape for sandbox.
 *   3. setup-token-pending — 'important' (NOT 'critical'). Fires once both
 *      URLs are set AND the daemon has emitted ADD_INSTALL_TOKEN; clears
 *      once an admin exists in the decree log (which is what readSetupState
 *      treats as 'done').
 *
 * The first two are 'critical' on purpose: setupMain throws if either URL
 * is null, so the daemon literally cannot start without them. 'critical'
 * severity blocks startup (per tasks.md) and aligns with that.
 *
 * The third is 'important' — NOT 'critical'. Earlier versions had it as
 * 'critical' and that produced an unrecoverable deadlock: if the action
 * was 'only-running' and the task never auto-cleared, stopping the service
 * any time after first install would lock the user out. Even with the
 * 'any'-availability action, leaving the task as 'critical' is wrong:
 * once both URLs are set, the daemon CAN run, so blocking startup on a
 * follow-up reminder is the wrong UX. 'important' surfaces the reminder
 * prominently without gating startup.
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
  const [mainUrls, sandboxUrls, store, decreeRaw] = await Promise.all([
    getMainUrls(effects),
    getSandboxUrls(effects),
    storeJson
      .read((s) => ({
        mainUrl: s.mainUrl,
        sandboxUrl: s.sandboxUrl,
        // `wizardCompletedNotified` is deliberately NOT selected here.
        //
        // The notification block below writes it back to store.json. The SDK
        // cancels a write to a file whose `.const()`-mapped value the write
        // would change — `Canceled: write after const` — because the running
        // handler's snapshot is now stale. Observed in the wild: the write
        // landed but init aborted with that error immediately after the
        // wizard's ADD_ADMIN_KEY decree.
        //
        // Excluding the field from the map means the mapped value is
        // unchanged by the write, so the guard doesn't fire. The latch is
        // read below with `.once()` instead. This is also more correct on its
        // own terms: flipping the latch should not re-run this watcher, and
        // selecting it made the watcher reactive to its own bookkeeping.
      }))
      .const(effects),
    // Reactive, and load-bearing: this is what re-runs the watcher when the
    // daemon first creates the decree log. Reading it with a bare `readFile`
    // meant the setup-token task never appeared, because nothing re-triggered
    // this handler after the daemon booted. See fileModels/decreeLog.ts.
    decreeLog.read((s) => s).const(effects),
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
    const state = parseSetupState(decreeRaw)
    if (state.kind === 'pending') {
      await sdk.action.createOwnTask(effects, showSetupTokenUrl, 'important', {
        replayId: 'setup-token-pending',
        reason: i18n(
          'Open this URL once and complete the wizard to create your CryptPad administrator account.',
        ),
      })
    } else {
      await sdk.action.clearTask(effects, 'setup-token-pending')
    }

    // First time we observe state === 'done' (i.e. ADD_ADMIN_KEY appeared
    // in the decree log → wizard has completed), post a one-shot success
    // notification so the user gets a phone ping confirming setup. The
    // wizardCompletedNotified flag is the latch — without it this branch
    // would fire on every container rebuild forever. Notifications are
    // not idempotent (per notifications.md), so the latch is mandatory.
    const alreadyNotified = await storeJson
      .read((s) => s.wizardCompletedNotified)
      .once()
    if (state.kind === 'done' && !alreadyNotified) {
      await sdk.notification.create(effects, {
        level: 'success',
        title: i18n('CryptPad setup complete'),
        message: i18n(
          'Your administrator account is active. Open the /admin/ panel inside CryptPad for further configuration.',
        ),
      })
      await storeJson.merge(effects, { wizardCompletedNotified: true })
    }
  }
})
