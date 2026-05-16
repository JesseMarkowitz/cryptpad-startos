import { readFile } from 'node:fs/promises'
import { sdk } from './sdk'

/**
 * Setup-token state derived from CryptPad's decree log on disk.
 *
 * Decree shape (verified against lib/api.js@v2026.2.2 — Hash.createChannelId
 * is concatenated twice and emitted as):
 *
 *     ["ADD_INSTALL_TOKEN", [token], "", +new Date()]
 *
 * The decree file is newline-delimited JSON at /data/decrees/decree.ndjson.
 *
 * # Completion signal — verified against a real wizard run
 *
 * CryptPad does NOT emit a paired RM_INSTALL_TOKEN decree when the install
 * wizard finishes — the token line stays in the log forever. Inspecting a
 * real decree log after a successful wizard run showed:
 *
 *     ["ADD_INSTALL_TOKEN", ["dd1921…"], "", t0]   ← from boot
 *     ["ADD_ADMIN_KEY",     ["267EvV…"], "", t1]   ← from wizard
 *     ["SET_INSTANCE_NAME",   …]                   ← wizard customization
 *     ["SET_INSTANCE_DESCRIPTION", …]
 *     …
 *
 * The token is never removed. CryptPad's lib/api.js logic (verified against
 * v2026.2.2) only emits ADD_INSTALL_TOKEN when the instance has zero
 * admins; once an admin exists, the existing token is simply never
 * referenced again, but it stays in the log. So the "setup is done" signal
 * we care about is the presence of any ADD_ADMIN_KEY decree, not a
 * paired removal of the token.
 *
 * Why this matters: the original RM_-scan parser would have left
 * setup-token-pending in the 'pending' state forever, regardless of
 * wizard completion. The task creation logic in init/setup.ts would have
 * permanently re-created the task on every reactive re-run. Combined with
 * the prior 'critical' severity, that produced an unrecoverable startup
 * deadlock the moment a user stopped the service.
 */
export type SetupState =
  | { kind: 'waiting-for-daemon' }
  | { kind: 'pending'; token: string }
  | { kind: 'done' }

export async function readSetupState(): Promise<SetupState> {
  const path = sdk.volumes.main.subpath('decrees/decree.ndjson')
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (e: unknown) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'ENOENT'
    ) {
      // The decree file does not exist until CryptPad has bootstrapped at
      // least once. From the user's perspective, both URLs may be set but
      // the daemon hasn't yet emitted ADD_INSTALL_TOKEN. Treat as "waiting."
      return { kind: 'waiting-for-daemon' }
    }
    throw e
  }
  if (raw.trim() === '') return { kind: 'waiting-for-daemon' }

  const lines = raw.split('\n').filter((line) => line.trim() !== '')
  let hasAdmin = false
  let liveToken: string | null = null
  for (const line of lines) {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      // Skip malformed lines defensively — the decree log is append-only
      // and a partial write at the end could leave one bad line. Don't let
      // it break the whole parse.
      continue
    }
    if (!Array.isArray(parsed) || parsed.length < 2) continue
    const verb = parsed[0]
    const args = parsed[1]
    if (typeof verb !== 'string' || !Array.isArray(args)) continue

    if (verb === 'ADD_ADMIN_KEY') {
      // Wizard completed (or admin added through the in-app /admin/ panel).
      // Either way: setup is done — no further token needed.
      hasAdmin = true
    } else if (verb === 'ADD_INSTALL_TOKEN' && typeof args[0] === 'string') {
      // Latest token wins. The log is append-only, so the last
      // ADD_INSTALL_TOKEN is the active one.
      liveToken = args[0]
    }
  }

  if (hasAdmin) return { kind: 'done' }
  if (liveToken !== null) return { kind: 'pending', token: liveToken }
  return { kind: 'waiting-for-daemon' }
}
