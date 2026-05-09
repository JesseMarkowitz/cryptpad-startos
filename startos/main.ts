import { chown, mkdir, writeFile } from 'node:fs/promises'
import { generateCryptpadConfig } from './cryptpadConfig'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { uiPort } from './utils'

// CryptPad's container runs as user/group cryptpad with UID/GID 4001.
// Verified in upstream Dockerfile@v2026.2.2:
//   addgroup -S cryptpad -g 4001 && adduser -S cryptpad
const CRYPTPAD_UID = 4001
const CRYPTPAD_GID = 4001

/**
 * Subdirectories under the main volume that CryptPad writes to. The volume
 * root mount is owned by root, so we pre-create each subpath as 4001:4001
 * before the daemon starts — pattern lifted from the prior attempt's
 * main.ts (cryptpad-startos@update/040 main.ts:60-73), which had it right.
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

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting CryptPad'))

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
      'CryptPad cannot start until both Main URL and Sandbox URL are set. ' +
        'Run the Set Main URL and Set Sandbox URL actions, then start the service.',
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
  await Promise.all(VOLUME_SUBDIRS.map(ensureDir))

  const appSub = await sdk.SubContainer.of(
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
  // @v2026.2.2) — our file existing means the entrypoint's auto-generation
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
        // Required by docker-entrypoint.sh@v2026.2.2 (declared as required
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
