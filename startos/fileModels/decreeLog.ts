import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

/**
 * CryptPad's decree log, as a *reactive* file model.
 *
 * # Why this is a FileHelper and not a plain readFile
 *
 * The setup-token task in `init/setup.ts` is created from state that lives in
 * this file, which CryptPad writes only once the daemon has booted. Reading it
 * with `node:fs/promises` — as this package did originally — makes the read
 * invisible to the init watcher's reactivity: `setupOnInit` re-runs when
 * something it read via `.const(effects)` changes, and a bare `readFile` is
 * not such a read.
 *
 * That produced a real, observed bug. On a fresh install the sequence is:
 *
 *   1. user sets Main URL      → store.json changes → watcher re-runs
 *   2. user sets Sandbox URL   → store.json changes → watcher re-runs; both
 *                                URLs now set, so it checks the decree log —
 *                                but the daemon hasn't started, so there is
 *                                no file yet and the state is 'waiting-for-daemon'
 *   3. user starts the service → daemon boots and writes ADD_INSTALL_TOKEN
 *                                → **nothing re-triggers the watcher**
 *
 * so the "Complete CryptPad Initial Setup" task never appeared and the user
 * had no way to reach the install-token URL.
 *
 * Reading through a FileHelper fixes it: `.const(effects)` installs an
 * `fs.watch` on the file and — via the SDK's `onCreated` helper, which walks
 * up and watches the nearest existing parent directory — also fires when the
 * file is *created* for the first time. That is exactly the step-3 transition
 * above.
 *
 * The model is a raw string rather than a parsed structure because the log is
 * newline-delimited JSON with heterogeneous, positionally-encoded rows; the
 * parsing (and its tolerance for partial trailing writes) lives in
 * `decrees.ts`. A missing or empty file reads back as `null`.
 *
 * Read-only by convention: CryptPad owns this file. Never write it from here.
 */
export const decreeLog = FileHelper.string({
  base: sdk.volumes.main,
  subpath: 'decrees/decree.ndjson',
})
