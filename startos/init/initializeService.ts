import { utils } from '@start9labs/start-sdk'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { sdk } from '../sdk'

/**
 * Install-only — write loginSalt to the volume's customize/application_config.js
 * EXACTLY ONCE.
 *
 * # Why this is load-bearing
 *
 * CryptPad hashes user passwords against AppConfig.loginSalt. The CryptPad
 * admin guide is explicit (admin_guide/installation.html, "Login salt"):
 *
 *     "The login salt can only be set when first creating your CryptPad
 *      instance. Changing it later will break logins for all existing users."
 *
 * If we ever regenerated the salt after the first install, every existing
 * user's password hash would become invalid and the only recovery would be
 * a full password reset — i.e. data loss for any user who's lost their
 * recovery info.
 *
 * # Why the file-existence guard is what enables backup-restore
 *
 * A backup-restore replays init with kind === 'install' (per init.md). If
 * we wrote loginSalt unconditionally on every 'install' kind, restore would
 * overwrite the original salt and brick all the user accounts in the
 * restored backup. The readFile / catch-ENOENT check below is THE thing
 * that prevents this. If anyone refactors this file in the future, that
 * guard MUST stay — the test plan in PLAN §14 verifies this end-to-end
 * (test 17a: post-restore login works with a pre-backup user account).
 */
export const initializeService = sdk.setupOnInit(async (effects, kind) => {
  if (kind !== 'install') return

  const appConfigPath = sdk.volumes.main.subpath(
    'customize/application_config.js',
  )

  // File-existence guard — see comment block above.
  try {
    await readFile(appConfigPath)
    return // already exists; never regenerate
  } catch (e: unknown) {
    if (
      typeof e !== 'object' ||
      e === null ||
      !('code' in e) ||
      (e as { code: string }).code !== 'ENOENT'
    ) {
      throw e
    }
    // ENOENT — file doesn't exist, proceed to generate.
  }

  // 64 chars from a 62-char alphabet (a-z + A-Z + 0-9) is ~381 bits of
  // entropy, well above CryptPad's documented "openssl rand -hex 32"
  // example (which produces 32 hex chars = 128 bits).
  const loginSalt = utils.getDefaultString({
    charset: 'a-z,A-Z,0-9',
    len: 64,
  })

  // The IIFE module-factory wrapper CryptPad's customize loader expects.
  // Verbatim shape lifted from upstream customize.dist/application_config.js
  // — it must handle BOTH module.exports (CommonJS, server-side) and AMD
  // define() (RequireJS, browser-side). Bare property assignments would
  // throw a ReferenceError and crash the client.
  const body = `(() => {
const factory = (AppConfig) => {
    AppConfig.loginSalt = ${JSON.stringify(loginSalt)};
    return AppConfig;
};
if (typeof(module) !== 'undefined' && module.exports) {
    module.exports = factory(require('../www/common/application_config_internal.js'));
} else if ((typeof(define) !== 'undefined' && define !== null) && (define.amd !== null)) {
    define(['/common/application_config_internal.js'], factory);
}
})();
`
  // Ensure the customize/ directory exists on the volume before writing.
  // mkdir with recursive:true is idempotent — if the dir already exists,
  // this is a no-op.
  await mkdir(sdk.volumes.main.subpath('customize'), { recursive: true })
  await writeFile(appConfigPath, body, { mode: 0o640 })
})
