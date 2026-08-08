import { chown, mkdir, writeFile } from 'node:fs/promises'
import { generateCryptpadConfig } from './cryptpadConfig'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { CRYPTPAD_GID, CRYPTPAD_UID } from './upstream-defaults'
import { uiPort } from './utils'

/**
 * Subdirectories under the main volume that CryptPad writes to. The volume
 * root mount is owned by root, so we pre-create each subpath as 4001:4001
 * before the daemon starts.
 *
 * `customize` and `onlyoffice-conf` are also subpath-mounted, so the
 * dirs must exist before SubContainer.of() resolves the mounts — both for
 * ownership and for the bind-mount target to exist.
 */
const VOLUME_SUBDIRS = [
  'datastore',
  'archive',
  'pins',
  'block',
  'blob',
  'blobstage',
  'tasks',
  'decrees',
  'logs',
  'customize',
  'onlyoffice-conf',
] as const

/**
 * Files inside chown'd subdirs that were created by init code running as
 * root and must be chown'd to the cryptpad user. The ensureDir loop below
 * only chowns the directories themselves; chown is not recursive in the
 * Node fs API, so files inside need their own pass.
 *
 * Currently the only such file is the loginSalt customize file written by
 * `init/writeLoginSalt.ts`. That init also chowns the file at create time,
 * so this list is defense-in-depth — it auto-heals stale installs from
 * before the create-time chown was added.
 */
const VOLUME_FILES = ['customize/application_config.js'] as const

export const main = sdk.setupMain(async ({ effects }) => {
  console.info('Starting CryptPad')

  const store = await storeJson
    .read((s) => ({
      mainUrl: s.mainUrl,
      sandboxUrl: s.sandboxUrl,
      adminKeys: s.adminKeys,
    }))
    .const(effects)

  // Defensive belt-and-suspenders for the daemon-start gate.
  // The 'critical' task severity in init/setup.ts is the primary gate (per
  // tasks.md, critical tasks block startup). If somehow setupMain is
  // invoked with null URLs anyway, a clear thrown error beats a silent
  // misconfiguration.
  if (!store?.mainUrl || !store?.sandboxUrl) {
    throw new Error(
      i18n(
        'CryptPad cannot start until both Main URL and Sandbox URL are set. Run the Set Main URL and Set Sandbox URL actions, then start the service.',
      ),
    )
  }

  // CryptPad's browser-side sandbox isolation depends on httpUnsafeOrigin and
  // httpSafeOrigin being different origins. The setter actions also gate on
  // this, but the check lives here too — refuse to launch with a clear
  // message rather than boot a broken security model if the store ever ends
  // up with matching origins (e.g. the user edits store.json directly).
  const mainOrigin = new URL(store.mainUrl).origin
  const sandboxOrigin = new URL(store.sandboxUrl).origin
  if (mainOrigin === sandboxOrigin) {
    throw new Error(
      i18n(
        'CryptPad cannot start: Main URL and Sandbox URL must be different origins, but both resolve to',
      ) +
        ' ' +
        mainOrigin +
        '. ' +
        i18n(
          'The browser uses the origin difference to enforce sandbox isolation around document rendering — same-origin would disable that protection. Re-run Set Main URL or Set Sandbox URL and pick an entry that differs in hostname or port.',
        ),
    )
  }

  // Pre-create data subdirs with cryptpad ownership. Idempotent — recursive
  // mkdir is a no-op if the dir already exists, and chown can be re-applied
  // safely.
  const ensureDir = async (rel: string) => {
    const path = sdk.volumes.main.subpath(rel)
    await mkdir(path, { recursive: true })
    await chown(path, CRYPTPAD_UID, CRYPTPAD_GID)
  }
  const ensureFileOwnership = async (rel: string) => {
    try {
      await chown(sdk.volumes.main.subpath(rel), CRYPTPAD_UID, CRYPTPAD_GID)
    } catch (e: unknown) {
      // ENOENT is expected on fresh installs before writeLoginSalt has run,
      // and on update kinds where the file may not exist yet.
      if (
        typeof e !== 'object' ||
        e === null ||
        !('code' in e) ||
        (e as { code: string }).code !== 'ENOENT'
      ) {
        throw e
      }
    }
  }
  await Promise.all([
    ...VOLUME_SUBDIRS.map(ensureDir),
    ...VOLUME_FILES.map(ensureFileOwnership),
  ])

  // `eager`, not `of`. As of start-sdk 2.0 `SubContainer.of` is lazy: it
  // returns synchronously and materializes the filesystem on first method
  // call, so `rootfs` widens to a Promise. We read `.rootfs` synchronously
  // below to pre-write config.js, and we want a failing `createFs` to throw
  // here rather than at some later first-use. `eager` gives both.
  const appSub = await sdk.SubContainer.eager(
    effects,
    { imageId: 'cryptpad' },
    sdk.Mounts.of()
      .mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: '/data',
        readonly: false,
      })
      .mountVolume({
        volumeId: 'main',
        subpath: 'customize',
        mountpoint: '/cryptpad/customize',
        readonly: false,
      })
      .mountVolume({
        volumeId: 'main',
        subpath: 'onlyoffice-conf',
        mountpoint: '/cryptpad/onlyoffice-conf',
        readonly: false,
      }),
    'cryptpad-sub',
  )

  // Pre-write config.js into the subcontainer's rootfs. The upstream
  // entrypoint guards with `[ ! -f "$CPAD_CONF" ]` (docker-entrypoint.sh
  // @2026.5.1) — our file existing means the entrypoint's auto-generation
  // sed branch is skipped entirely, leaving us in full control.
  await writeFile(
    `${appSub.rootfs}/cryptpad/config/config.js`,
    generateCryptpadConfig({
      httpUnsafeOrigin: new URL(store.mainUrl).origin,
      httpSafeOrigin: new URL(store.sandboxUrl).origin,
      adminKeys: store.adminKeys,
    }),
  )

  return sdk.Daemons.of(effects).addDaemon('primary', {
    subcontainer: appSub,
    exec: {
      command: sdk.useEntrypoint(),
      env: {
        // Required by docker-entrypoint.sh@2026.5.1 (declared as required
        // vars at the top of the script):
        //
        //   CPAD_CONF — pointed at our pre-written file so the entrypoint's
        //               auto-generation branch is skipped.
        //   CPAD_MAIN_DOMAIN / CPAD_SANDBOX_DOMAIN — only used by the
        //               entrypoint's sed substitution (which we bypass), but
        //               we pass them anyway in case future image scripts
        //               look at them.
        CPAD_CONF: '/cryptpad/config/config.js',
        CPAD_MAIN_DOMAIN: new URL(store.mainUrl).origin,
        CPAD_SANDBOX_DOMAIN: new URL(store.sandboxUrl).origin,
        // CPAD_INSTALL_ONLYOFFICE deliberately UNSET. OnlyOffice is baked
        // into the image at build time (see Dockerfile). Setting this to
        // "yes" would re-run the ~210 MB install on every container start.
      },
    },
    ready: {
      display: i18n('Web Interface'),
      // Default is 10s, and that is uncomfortably tight here. The upstream
      // entrypoint runs `npm run build` on EVERY container start (it
      // regenerates ~25 www/*/index.html files before `node server.js`), so
      // the port is not bound for several seconds. Measured ~8s on x86_64;
      // slower storage or aarch64 would exceed the default and make the UI
      // flash a red failure on every single restart. Within the grace period
      // `failure` is reported as `starting` instead.
      //
      // This does not silence the health check's own "Error while fetching
      // URL / ECONNREFUSED" log lines during boot — those come from
      // checkWebUrl itself and are expected noise until the server binds.
      gracePeriod: 60_000,
      // /api/config is the same endpoint CryptPad's own client UI fetches
      // during boot — the canonical application-defined readiness signal.
      // 200 here means: Node server up, config parsed, API responding.
      // Stronger than checkPortListening (port can be open before app is
      // serving) and stronger than bare / (which can 200 from a half-
      // initialized server).
      fn: () =>
        sdk.healthCheck.checkWebUrl(
          effects,
          `http://localhost:${uiPort}/api/config`,
          {
            successMessage: i18n('CryptPad is ready'),
            errorMessage: i18n('CryptPad is not ready'),
          },
        ),
    },
    requires: [],
  })
})
