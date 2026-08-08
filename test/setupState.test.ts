import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSetupState } from '../startos/setupState.ts'

/**
 * Regression tests for the decree-log parser.
 *
 * Run with `npm test` (plain `node --test` — Node 22 strips the types, so this
 * needs no test framework and no devDependencies; no Start9 package ships one).
 *
 * Why this lives in `test/` rather than beside the source: the import needs an
 * explicit `.ts` extension (Node's resolver requires a full specifier), which
 * TypeScript rejects without `allowImportingTsExtensions` — and that flag would
 * force `noEmit` into `tsconfig.json`, risking the `ncc` build. Putting the file
 * outside `startos/` sidesteps it entirely: the SDK's build gate type-checks and
 * lints TypeScript under `startos/` only — `lint.mjs` hardcodes that glob — so a
 * test here is neither type-checked nor linted. Running it is what validates it.
 *
 * Why these exist: the parser is hand-rolled and tracks an upstream log format
 * that carries no compatibility guarantee. It has already produced one real bug
 * — the "Complete CryptPad Initial Setup" task never appearing — and a green
 * `tsc` says nothing about whether it reads a real log correctly. `UPDATING.md`
 * lists the decree format as the highest-risk thing to re-verify on an upstream
 * bump; this is the cheap half of that check.
 *
 * The fixtures are shaped like a real CryptPad 2026.5.1 log but the token and
 * key values are synthetic. Never paste values from a live instance here — an
 * install token grants first-admin creation.
 */

/** A real boot log: token issued, no admin yet. Includes the two rows that
 *  accompany it in practice, one of which is deliberately malformed-looking. */
const BOOT_LOG = [
  '["ADD_INSTALL_TOKEN",["0000000000000000000000000000000000000000000000000000000000000000"],"",1786071892428]',
  '["SET_BEARER_SECRET",["c2FtcGxlLWJlYXJlci1zZWNyZXQtdmFsdWUtZm9yLXRlc3Rz"],"INTERNAL",1786071892431]',
  // args is a bare number, not an array — upstream really emits this shape.
  '["PROOFS_MIGRATED",1,"server",1786071892800]',
].join('\n')

const ADMIN_ROW =
  '["ADD_ADMIN_KEY",["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0="],"",1786071999999]'

test('a boot log with a token and no admin is pending, and returns that token', () => {
  const state = parseSetupState(BOOT_LOG)
  assert.equal(state.kind, 'pending')
  assert.equal(
    state.kind === 'pending' ? state.token : null,
    '0000000000000000000000000000000000000000000000000000000000000000',
  )
})

test('an ADD_ADMIN_KEY row means setup is done, even though the token remains', () => {
  // Upstream never removes the token; presence of an admin is the completion
  // signal. A parser scanning for RM_INSTALL_TOKEN would hang here forever.
  assert.deepEqual(parseSetupState(`${BOOT_LOG}\n${ADMIN_ROW}`), {
    kind: 'done',
  })
})

test('a missing or empty log is waiting-for-daemon', () => {
  assert.deepEqual(parseSetupState(null), { kind: 'waiting-for-daemon' })
  assert.deepEqual(parseSetupState(''), { kind: 'waiting-for-daemon' })
  assert.deepEqual(parseSetupState('   \n  \n'), { kind: 'waiting-for-daemon' })
})

test('a truncated trailing line is skipped, not fatal', () => {
  // The log is append-only, so a crash mid-write can leave a partial last line.
  const state = parseSetupState(`${BOOT_LOG}\n["ADD_ADMIN_KE`)
  assert.equal(state.kind, 'pending')
})

test('rows whose args are not an array are ignored rather than throwing', () => {
  // PROOFS_MIGRATED is the real-world case; the parser must not assume args[0].
  assert.deepEqual(parseSetupState('["PROOFS_MIGRATED",1,"server",1]'), {
    kind: 'waiting-for-daemon',
  })
  assert.deepEqual(parseSetupState('["ADD_INSTALL_TOKEN",5,"",1]'), {
    kind: 'waiting-for-daemon',
  })
})

test('the last ADD_INSTALL_TOKEN wins', () => {
  const two = [
    '["ADD_INSTALL_TOKEN",["1111111111111111111111111111111111111111111111111111111111111111"],"",1]',
    '["ADD_INSTALL_TOKEN",["2222222222222222222222222222222222222222222222222222222222222222"],"",2]',
  ].join('\n')
  const state = parseSetupState(two)
  assert.equal(
    state.kind === 'pending' ? state.token : null,
    '2222222222222222222222222222222222222222222222222222222222222222',
  )
})

test('non-array and non-decree JSON lines are ignored', () => {
  assert.deepEqual(parseSetupState('{"not":"a decree"}\n"bare string"\n42'), {
    kind: 'waiting-for-daemon',
  })
})
