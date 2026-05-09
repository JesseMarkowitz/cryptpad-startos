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
 * Removal of a token (after the user completes the install wizard) is also
 * a decree. The exact removal verb wasn't visible in the lib/api.js
 * excerpts I could fetch — we use a defensive parser that treats any verb
 * starting with "RM_" whose first token-arg matches the live one as a
 * consumption (PLAN §13 open question 2). When v1 hits a real running
 * CryptPad we'll inspect the produced decree log and tighten this if
 * needed.
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

    if (verb === 'ADD_INSTALL_TOKEN' && typeof args[0] === 'string') {
      liveToken = args[0]
    } else if (verb.startsWith('RM_') && args[0] === liveToken) {
      liveToken = null
    }
  }

  return liveToken === null ? { kind: 'done' } : { kind: 'pending', token: liveToken }
}
