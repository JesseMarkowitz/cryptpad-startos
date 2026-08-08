> [!NOTE]
> **Superseded — historical design document.** This plan was written before any code existed
> (its "Status" line below is stale: the package is fully implemented). It is retained for the
> design rationale and the record of locked decisions. For current state see `README.md`
> (architecture), `TODO.md` (live worklist), `NextSteps.md` (release-gate test checklist), and
> `UPDATING.md` (upstream tracking). Version and SDK details in this document are out of date:
> the package now wraps CryptPad 2026.5.1 on start-sdk 2.0.9.

# CryptPad on StartOS — Phase 1 Plan

**Status:** Awaiting approval. No code written yet. This file is the only artifact in `~/myworkspace/cryptpad-startos/`.

**Author note (paths):** the brief references `~/MyWorkspace/`. The actual workspace on disk is `~/myworkspace/` (lowercase). All paths in this document use the lowercase form. The clone command and PLAN path used `myworkspace/`.

**Author note (prior-attempt branch):** the brief said clone branch `update/040`. There is also a `v2-clean` branch in the same repo (HEAD `9c2fcd8`, Apr 13) where Jesse experimented with an in-container `sandbox-proxy` daemon forwarding port 3001 → 3000. The brief's locked decision #1 explicitly rejects port 3001, which is the rejection of `v2-clean`'s approach in favour of "two MultiHosts both binding port 3000." So `update/040` is the correct reference: it is the design point the brief is course-correcting back toward, not the experiment that was tried after. The clone at `~/myworkspace/cryptpad-startos-prior/` is on `update/040` at HEAD `0a5c480`.

---

## Design Conflicts Discovered

None of the locked decisions in the brief conflict with research findings. Two minor refinements I'd like to confirm with Jesse before Phase 2 — they are *not* changes to locked decisions, but they do add nuance to how we describe the design:

1. **Why two-binding-on-3000 works** — the brief says "CryptPad's Node server discriminates by HTTP `Host:` header." Reading `lib/http-worker.js@main`, that's not quite the mechanism: CryptPad's HTTP server serves the same content regardless of `Host`. CSP differentiation is by URL path (e.g. `/api/`, OnlyOffice paths), not by host. The reason two origins are required is **browser-side**: when the browser sees `httpUnsafeOrigin` and `httpSafeOrigin` as different origins, its same-origin policy enforces the sandbox iframe boundary. CryptPad's server doesn't need to know or care which host you're hitting; it just emits the same HTML/JS, and the browser does the isolation. This refinement does not change any code, but the README and code comments should describe it accurately so future maintainers don't go looking for non-existent host-routing logic. *(Locked decision #1 stands as-is.)*

2. **`CPAD_INSTALL_ONLYOFFICE` env var fate** — `docker-entrypoint.sh@main` only invokes `install-onlyoffice.sh` when this var is `"yes"`. With our build-time install, the install has already happened before the entrypoint runs, so we don't need the var. We should *omit* it (don't set it to `"yes"` — that would re-run install on every container start, slow and wasteful; don't set it at all, fall through to the no-op branch). I want to flag this because the prior attempt set it to `"yes"`. *(Locked decision #2 stands as-is.)*

If neither of these surfaces a different intent than what was locked, both are stylistic notes and we proceed.

---

## 1. Upstream version pinning

| Field | Value |
|---|---|
| Upstream tag | `2026.2.2` (released 2026-04-01, ~1 month old as of 2026-05-08) |
| Docker image | `cryptpad/cryptpad:version-2026.2.2` |
| Architectures | `linux/amd64`, `linux/arm64`. Confirmed on Docker Hub; no `riscv64` published. |
| StartOS package version | `2026.2.2:0-alpha.0` |
| Version file | `startos/install/versions/v2026.2.2.0.a0.ts` |
| Promotion path | `:0-alpha.0` → `:0` once §14 manual test plan passes end-to-end |

**Sources verified:** Docker Hub tags listing (`hub.docker.com/r/cryptpad/cryptpad/tags`); upstream `Dockerfile@main`; `config/config.example.js@main`; `lib/api.js@main`; `lib/http-worker.js@main`; `install-onlyoffice.sh@main`; `docker-entrypoint.sh@main`. Re-pin to a tagged commit (`v2026.2.2`) when sourcing constants if `main` ever drifts before we ship.

---

## 2. Manifest and package metadata

### `startos/manifest/index.ts`

```typescript
export const manifest = setupManifest({
  id: 'cryptpad',
  title: 'CryptPad',
  license: 'AGPL-3.0',
  packageRepo:  'https://github.com/JesseMarkowitz/cryptpad-startos',
  upstreamRepo: 'https://github.com/cryptpad/cryptpad',
  marketingUrl: 'https://cryptpad.org/',
  donationUrl:  'https://opencollective.com/cryptpad',
  docsUrls: ['https://docs.cryptpad.org/en/admin_guide/index.html'],
  description: { short, long },
  volumes: ['main'],
  images: {
    cryptpad: {
      source: { dockerBuild: {} },           // Custom Dockerfile in repo root, no workdir
      arch:   ['x86_64', 'aarch64'],
    },
  },
  alerts: {
    install:  alertInstall,                  // see §2 wording below
    update:   null,
    uninstall: null,
    restore:  null,
    start:    null,
    stop:     null,
  },
  dependencies: {},
})
```

### `startos/manifest/i18n.ts` — wording deltas vs. prior

`short` and `long` keep the prior attempt's wording for all five locales (en_US, es_ES, de_DE, pl_PL, fr_FR) — they describe CryptPad accurately and translate cleanly. **Drop these phrases from `alertInstall`** (carried over from prior, now wrong):

- "On first start, CryptPad will download the OnlyOffice editors … 10–15 minutes" — false in v1; OnlyOffice is built into the image.
- "run the 'Set Admin Keys' action to grant yourself administrator access" — replaced by the install-token URL flow.

**New `alertInstall` (English, translated to the other four locales):**

> CryptPad on StartOS requires two domains for full browser sandbox security — a *main* domain for the app and a *sandbox* domain for isolated document rendering. After installing, complete the **Set Main URL** and **Set Sandbox URL** tasks; CryptPad will start once both are set. A third **Complete CryptPad Initial Setup** task will then surface the install-token URL — open it in a browser to create your administrator account. CryptPad has no built-in email integration; account flows are end-to-end-encrypted and local. All other configuration (uploads, registration, custom branding) lives in CryptPad's own `/admin/` panel.

### Assets

| Asset | Source | Notes |
|---|---|---|
| `icon.svg` | Symlink → `assets/CryptPad_logo.svg` (re-fetched from upstream `customize.dist/CryptPad_logo.svg@v2026.2.2`) | Prior attempt symlinked into the now-removed git submodule; new asset path lives under `assets/`. |
| `LICENSE` | Re-fetched from `cryptpad/cryptpad@v2026.2.2/LICENSE` | AGPL-3.0 text. Drop the prior attempt's symlink-into-submodule. |
| `instructions.md` | Generated from README sections | Required by `start-cli s9pk pack` in 0.4.0.x. |

---

## 3. Volume and path layout

### Mount table — `setupMain`

| Volume | Subpath | Mountpoint (in container) | RW |
|---|---|---|---|
| `main` | `null` (root) | `/data` | rw |
| `main` | `customize/` | `/cryptpad/customize` | rw |
| `main` | `onlyoffice-conf/` | `/cryptpad/onlyoffice-conf` | rw |

Three mounts. **No** `customize/dist` mount (build-time install, image rootfs only — locked decision #2).

### Layout under `/data` (i.e. on the volume root)

```
/data/
├── store.json                       # StartOS-managed state (3 fields)
├── datastore/                       # filePath
├── archive/                         # archivePath
├── pins/                            # pinPath
├── block/                           # blockPath
├── blob/                            # blobPath
├── blobstage/                       # blobStagingPath
├── tasks/                           # taskPath  ← added vs. prior; see note
├── decrees/                         # decreePath  (decree.ndjson lives here)
├── logs/                            # logPath
├── customize/                       # mounted at /cryptpad/customize
│   └── application_config.js        # contains AppConfig.loginSalt (write-once)
└── onlyoffice-conf/                 # mounted at /cryptpad/onlyoffice-conf
    └── onlyoffice.properties        # OnlyOffice install state
```

**Note on `taskPath`:** `config/config.example.js@main` lists `taskPath: './data/tasks'` in addition to the eight paths the brief enumerates. The prior attempt did not override it, leaving CryptPad's scheduled-task storage at the upstream relative default (`./data/tasks`, which under our setup resolves inside the container to `/cryptpad/data/tasks` — that path doesn't exist as a volume mount, so writes either go to rootfs (ephemeral!) or fail). Adding `taskPath: '/data/tasks'` to our overrides closes that gap. *(This is a minor correction to the prior attempt; calling it out explicitly so it's not silently picked up.)*

### `startos/fileModels/store.json.ts` schema

```typescript
const shape = z.object({
  adminKeys:  z.array(z.string()).catch([]),
  mainUrl:    z.string().nullable().catch(null),
  sandboxUrl: z.string().nullable().catch(null),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'store.json' },
  shape,
)
```

Three fields total. Everything else from the prior attempt (`adminEmail`, `termsUrl`, `privacyUrl`, `maxUploadSize`, `maxWorkerCount`, `restrictRegistration`, `allowEmbedding`) is dropped — covered by CryptPad's in-app `/admin/` panel (locked decision #9).

### Path overrides written into the generated `config.js`

| Key | Value | Source |
|---|---|---|
| `filePath` | `'/data/datastore/'` | upstream default `./datastore/` |
| `archivePath` | `'/data/archive/'` | upstream default `./data/archive` |
| `pinPath` | `'/data/pins/'` | upstream default `./data/pins` |
| `blockPath` | `'/data/block/'` | upstream default `./block` |
| `blobPath` | `'/data/blob/'` | upstream default `./blob` |
| `blobStagingPath` | `'/data/blobstage/'` | upstream default `./data/blobstage` |
| `taskPath` | `'/data/tasks/'` | upstream default `./data/tasks` |
| `decreePath` | `'/data/decrees/'` | upstream default `./data/decrees` |
| `logPath` | `'/data/logs/'` | upstream default `./data/logs` |

Trailing slashes per the upstream defaults' style (some have them, some don't — we normalise to "always slash" for consistency; CryptPad's path-joining handles either form).

---

## 4. Image strategy

### Custom Dockerfile (repo root, named `Dockerfile`)

```dockerfile
# DO NOT add nginx/Caddy/Traefik or any other reverse proxy to this image.
# CryptPad's Node server already serves the correct CSP/COEP/CORP headers
# for the /checkup/ self-test; an in-container proxy duplicates them and
# breaks browser security checks. StartOS terminates TLS at the platform
# layer — there is nothing for an in-container proxy to do.
#
# CryptPad's HTTP server on port 3000 internally proxies /cryptpad_websocket
# to its own WebSocket server on port 3003 (lib/http-worker.js: server.on
# 'upgrade' → wsProxy.upgrade). Port 3003 must NEVER be bound externally.

FROM cryptpad/cryptpad:version-2026.2.2

USER root
RUN ./install-onlyoffice.sh --accept-license --trust-repository

# Restore the unprivileged runtime user (UID/GID 4001) the upstream
# Dockerfile sets via `USER cryptpad`.
USER cryptpad
```

### Manifest reference

`source: { dockerBuild: {} }` — Dockerfile in project root, no `workdir`, default name. Aligns with `manifest.md` "Local Docker Build" pattern.

### Build-time network dependencies (document in README "Building from Source")

`install-onlyoffice.sh` fetches:

- `https://github.com/cryptpad/onlyoffice-builds.git` (git clone)
- `https://github.com/cryptpad/onlyoffice-editor/releases/download/...`
- `https://github.com/cryptpad/onlyoffice-x2t-wasm/releases/download/...`
- `https://raw.githubusercontent.com/ONLYOFFICE/web-apps/master/LICENSE.txt` (license display only; bypassed by `--accept-license` but the curl still happens — script reads it before the bypass check)

Total payload: ~210 MB additional layer. Build requires network access; no offline-build option in v1.

### `startos/upstream-defaults.ts`

A dedicated file encoding constants we read out of upstream's `config/config.example.js` so the source-of-truth pin is explicit:

```typescript
/**
 * Constants extracted from upstream's config/config.example.js at tag v2026.2.2.
 * If you bump CryptPad version, re-verify these against the new tag.
 *   File:  https://github.com/cryptpad/cryptpad/blob/v2026.2.2/config/config.example.js
 */
export const UPSTREAM_HTTP_PORT       = 3000   as const
export const UPSTREAM_HTTP_SAFE_PORT  = 3001   as const  // dev-only fallback; we never bind it
export const UPSTREAM_WEBSOCKET_PORT  = 3003   as const  // proxied internally; we never bind it
export const UPSTREAM_INSTALL_METHOD  = 'docker' as const
export const UPSTREAM_HTTP_ADDRESS    = '0.0.0.0' as const
```

`startos/utils.ts` re-exports `uiPort = UPSTREAM_HTTP_PORT`, `wsPort = UPSTREAM_WEBSOCKET_PORT` so existing import paths stay short.

---

## 5. Interfaces — `startos/interfaces.ts`

### Two MultiHost bindings, both on port 3000

```typescript
import { i18n } from './i18n'
import { sdk } from './sdk'
import { uiPort } from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  // Why two MultiHosts on the same container port:
  //   CryptPad's browser sandbox model requires httpUnsafeOrigin ≠ httpSafeOrigin —
  //   the sandbox iframe must load from a different ORIGIN so the browser's
  //   same-origin policy isolates it from the main app.
  //
  //   StartOS gives each MultiHost a distinct hostname. Both bindings target
  //   port 3000 inside the container; CryptPad's HTTP server serves the same
  //   content regardless of Host (CSP differentiation is by URL path, not host —
  //   verified in lib/http-worker.js@v2026.2.2). The browser does the isolation.
  //
  //   The 'api' type on the sandbox interface keeps it OUT of the StartOS UI's
  //   clickable launch list — the sandbox is internal iframe machinery, not a
  //   user destination.

  const uiMulti      = sdk.MultiHost.of(effects, 'ui-multi')
  const sandboxMulti = sdk.MultiHost.of(effects, 'sandbox-multi')

  const uiOrigin      = await uiMulti.bindPort(uiPort, { protocol: 'http' })
  const sandboxOrigin = await sandboxMulti.bindPort(uiPort, { protocol: 'http' })

  const ui = sdk.createInterface(effects, {
    name:        i18n('Web UI'),
    id:          'ui',
    description: i18n('The CryptPad collaborative editor'),
    type:        'ui',
    masked:      false,
    schemeOverride: null,
    username:    null,
    path:        '',
    query:       {},
  })

  const sandbox = sdk.createInterface(effects, {
    name:        i18n('Sandbox Origin'),
    id:          'sandbox',
    description: i18n(
      'Internal iframe origin for CryptPad\'s document sandbox. ' +
      'Loaded automatically by the main UI; not a user destination. ' +
      'Required separately so the browser sees a different origin and ' +
      'can enforce sandbox isolation via the same-origin policy.',
    ),
    type:        'api',                  // ← non-clickable in the StartOS launcher
    masked:      false,
    schemeOverride: null,
    username:    null,
    path:        '',
    query:       {},
  })

  return [
    await uiOrigin.export([ui]),
    await sandboxOrigin.export([sandbox]),
  ]
})
```

**Counts:**

- 2 MultiHosts (ui-multi, sandbox-multi)
- 2 interfaces (ui, sandbox)
- 1 internal port (3000)
- 0 external WebSocket bindings (port 3003 is internal only — proxied by CryptPad's own HTTP server)

**Dropped from prior attempt** (4 → 2 interfaces): `admin` and `checkup` overlays. Their access lives on the same `ui` origin under `/admin/` and `/checkup/` paths — surfaced via the **Run Diagnostics** action and CryptPad's own admin UI, not as separate StartOS interface launchers.

### WebSocket flow

```
Browser ──── wss://main-host/cryptpad_websocket  (port 443, TLS by StartOS)
   │
   ▼
StartOS edge proxy ──── http://container:3000/cryptpad_websocket
   │
   ▼
CryptPad HTTP server (Node)
   │  server.on('upgrade', ws => wsProxy.upgrade(...))
   ▼
CryptPad WebSocket server on localhost:3003 (same Node process)
```

Port 3003 is never reached from outside the container. Declared in `upstream-defaults.ts` for documentation; never passed to any `bindPort()`.

---

## 6. SMTP / email — intentionally empty

Locked decision #9 stands. Section number preserved for stable cross-references.

CryptPad has **no email/SMTP integration in any current release**. The "support help-desk" feature uses CryptPad's own E2E-encrypted in-app messaging, not email. Adding an SMTP config would wire credentials into a feature that has nothing to receive them. Upstream issue #1047 ("Email notifications") confirms this is still an open feature request, not an implemented capability. README "Limitations" must say so explicitly: *"CryptPad has no email integration; account flows are E2E-encrypted and local. If a future CryptPad release adds SMTP support, this package will revisit."*

---

## 7. Init scripts — `startos/init/`

Three `setupOnInit` functions, registered in this order in `startos/init/index.ts`:

```typescript
export const init = sdk.setupInit(
  restoreInit,
  versionGraph,
  seedFiles,           // 7.1
  setInterfaces,
  setDependencies,
  actions,
  initializeService,   // 7.2 — install-only loginSalt write
  setup,               // 7.3 — reactive URL/setup-token watcher
)
```

The order matters: `setInterfaces` and `actions` must register before `initializeService` and `setup` so that `createOwnTask` can reference action definitions and `getOwn` can resolve interfaces.

### 7.1 `seedFiles.ts`

```typescript
export const seedFiles = sdk.setupOnInit(async (effects) => {
  await storeJson.merge(effects, {})        // applies all .catch() defaults
})
```

No `kind` parameter (per init.md "Empty-Seed Inits: Drop the `kind` Parameter"). Runs every init kind; the `merge({})` is idempotent.

### 7.2 `initializeService.ts` — `kind === 'install'` only

```typescript
import { utils } from '@start9labs/start-sdk'
import { readFile } from 'node:fs/promises'

export const initializeService = sdk.setupOnInit(async (effects, kind) => {
  if (kind !== 'install') return

  // Write loginSalt to the volume's customize/application_config.js — ONCE.
  //
  // This file is load-bearing. CryptPad hashes user passwords against
  // AppConfig.loginSalt (https://docs.cryptpad.org/en/admin_guide/installation.html
  // — "Login salt can only be set when first creating your CryptPad instance.
  // Changing it later will break logins for all existing users.").
  //
  // The file-existence guard below is what makes backup-restore safe: a restore
  // replays init with kind === 'install' (per init.md), and we MUST NOT
  // regenerate the salt — doing so would invalidate every existing user's
  // password hash.

  const appConfigPath = sdk.volumes.main.subpath('customize/application_config.js')

  let exists = false
  try { await readFile(appConfigPath); exists = true } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e
  }
  if (exists) return                       // never overwrite

  const loginSalt = utils.getDefaultString({
    charset: 'a-z,A-Z,0-9',
    len: 64,
  })

  // Exact IIFE module-factory wrapper CryptPad's customize loader expects
  // (handles both module.exports CommonJS and AMD define() contexts).
  // Verbatim shape lifted from upstream customize.dist/application_config.js
  // — preserved from the prior attempt's main.ts (it had the right shape, just
  // wrote it on the wrong trigger and never wrote loginSalt).
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
  await mkdir(sdk.volumes.main.subpath('customize'), { recursive: true })
  await writeFile(appConfigPath, body, { mode: 0o640 })
})
```

**Crucial**: do **not** create the install-token critical task here. That task is created reactively in §7.3 once the daemon has actually emitted the `ADD_INSTALL_TOKEN` decree (which only happens when both URLs are set, the daemon has started, and `adminKeys` is empty). Creating it here would surface a "show setup token URL" task that blows up because there is no decree to read yet.

**Note vs. prior attempt:** the prior attempt's `initializeService` only created two `'important'` tasks (set-admin-keys and set-instance-config). It never wrote `loginSalt`. v1 fixes this; that's a security delta worth calling out in the first commit message and the v1 release notes ("v1 fixes loginSalt persistence vs. the prior 0.4.0 attempt").

### 7.3 `setup.ts` — reactive watcher (every init kind, no `kind` guard)

This is the workhorse. Modelled on `vaultwarden-startos/startos/init/setup.ts` (reactive `.const()` watcher inside `setupOnInit`), but generalised to two URLs and a setup-token follow-up.

```typescript
import { readFile } from 'node:fs/promises'

export const setup = sdk.setupOnInit(async (effects) => {
  const [mainUrls, sandboxUrls, store] = await Promise.all([
    getMainUrls(effects),                 // helper in utils.ts — see below
    getSandboxUrls(effects),
    storeJson
      .read((s) => ({ mainUrl: s.mainUrl, sandboxUrl: s.sandboxUrl, adminKeys: s.adminKeys }))
      .const(effects),
  ])

  // ── Main URL ─────────────────────────────────────────────────────────────
  if (!store?.mainUrl) {
    await sdk.action.createOwnTask(effects, setMainUrl, 'critical', {
      replayId: 'main-url-not-set',
      reason:   i18n('Choose the primary domain for the CryptPad UI.'),
    })
    await sdk.action.clearTask(effects, 'main-url-unavailable')
  } else if (!mainUrls.includes(store.mainUrl)) {
    await sdk.action.createOwnTask(effects, setMainUrl, 'critical', {
      replayId: 'main-url-unavailable',
      reason:   i18n('Your previously selected Main URL is no longer available. Pick a new one.'),
    })
    await sdk.action.clearTask(effects, 'main-url-not-set')
  } else {
    await sdk.action.clearTask(effects, 'main-url-not-set')
    await sdk.action.clearTask(effects, 'main-url-unavailable')
  }

  // ── Sandbox URL (same shape) ────────────────────────────────────────────
  if (!store?.sandboxUrl) {
    await sdk.action.createOwnTask(effects, setSandboxUrl, 'critical', {
      replayId: 'sandbox-url-not-set',
      reason:   i18n('Choose the sandbox domain for CryptPad\'s document iframe isolation.'),
    })
    await sdk.action.clearTask(effects, 'sandbox-url-unavailable')
  } else if (!sandboxUrls.includes(store.sandboxUrl)) {
    await sdk.action.createOwnTask(effects, setSandboxUrl, 'critical', {
      replayId: 'sandbox-url-unavailable',
      reason:   i18n('Your previously selected Sandbox URL is no longer available. Pick a new one.'),
    })
    await sdk.action.clearTask(effects, 'sandbox-url-not-set')
  } else {
    await sdk.action.clearTask(effects, 'sandbox-url-not-set')
    await sdk.action.clearTask(effects, 'sandbox-url-unavailable')
  }

  // ── Setup-token follow-up ───────────────────────────────────────────────
  // Only create the task once both URLs are set AND the daemon has emitted
  // the ADD_INSTALL_TOKEN decree. We detect the decree by reading
  // /data/decrees/decree.ndjson; the file does not exist until the daemon
  // has started for the first time, so a missing file means "wait."
  if (store?.mainUrl && store?.sandboxUrl) {
    const setupNeeded = await isSetupPending(effects)
    if (setupNeeded === 'pending') {
      await sdk.action.createOwnTask(effects, showSetupTokenUrl, 'critical', {
        replayId: 'setup-token-pending',
        reason:   i18n(
          'Open this URL once and complete the wizard to create your CryptPad administrator account.',
        ),
      })
    } else {
      await sdk.action.clearTask(effects, 'setup-token-pending')
    }
  }
})
```

`isSetupPending(effects)` returns `'pending' | 'done' | 'waiting-for-daemon'` based on the decree log. See §9c for the parsing logic — `setup.ts` and the `show-setup-token-url` action share the same parser.

### 7.4 `setupMain` — daemon-start gate

The 'critical' task severity in §7.3 is **the** gate: per `tasks.md`, "critical — Blocks the service from starting until the user completes the task." Until both URL tasks clear, StartOS will not invoke `setupMain`.

`setupMain` still defends against being called with null URLs (belt-and-suspenders — also useful if a future StartOS version changes blocking semantics). The defence is a plain `throw` with a clear message, mirroring `vaultwarden-startos/startos/main.ts:14` (`if (!config) throw new Error('No config.json')`):

```typescript
if (!store?.mainUrl || !store?.sandboxUrl) {
  throw new Error(
    'CryptPad cannot start until both Main URL and Sandbox URL are set. ' +
    'Run the Set Main URL and Set Sandbox URL actions, then start the service.',
  )
}
```

I checked the SDK for a `HealthReceipt.never` construct (mentioned tentatively in the brief) — I cannot find it in the docs at `start-docs/packaging/src/main.md` and the local node_modules of reference packages aren't installed for me to grep the SDK's TypeScript definitions. The `throw` pattern is used in production by Vaultwarden, is the documented "fail fast" path for setupMain, and produces a clear log message for the user. I'd rather use what's confirmed than introduce a construct that may not exist; if Jesse knows of `HealthReceipt.never` and prefers it, easy swap in Phase 2.

`setupMain` does NOT create or clear tasks — that's `setup.ts`'s job. `setupMain` only writes config and starts daemons.

---

## 8. Config injection — `setupMain` writes `config.js` to subcontainer rootfs

This section is a pointer to the `setupMain` skeleton that lives conceptually in §7.4 / §11. To keep the plan readable I'm putting the full code sketch in this section (the brief allowed §8 to be a pointer; I think the code is short enough to be useful here).

```typescript
// startos/main.ts (sketch)
import { writeFile, mkdir, chown } from 'node:fs/promises'

export const main = sdk.setupMain(async ({ effects }) => {
  const store = await storeJson
    .read((s) => ({ mainUrl: s.mainUrl, sandboxUrl: s.sandboxUrl, adminKeys: s.adminKeys }))
    .const(effects)

  if (!store?.mainUrl || !store?.sandboxUrl) {
    throw new Error(/* see §7.4 */)
  }

  const appSub = await sdk.SubContainer.of(
    effects,
    { imageId: 'cryptpad' },
    sdk.Mounts.of()
      .mountVolume({ volumeId: 'main', subpath: null,              mountpoint: '/data',                 readonly: false })
      .mountVolume({ volumeId: 'main', subpath: 'customize',       mountpoint: '/cryptpad/customize',   readonly: false })
      .mountVolume({ volumeId: 'main', subpath: 'onlyoffice-conf', mountpoint: '/cryptpad/onlyoffice-conf', readonly: false }),
    'cryptpad-sub',
  )

  // Pre-create data subdirectories owned by UID/GID 4001 — the volume root is
  // root-owned but cryptpad runs as 4001 and cannot create subdirs by itself.
  // Pattern preserved verbatim from prior attempt (cryptpad-startos-prior/startos/main.ts:60-73).
  const ensureDir = async (rel: string) => {
    const p = sdk.volumes.main.subpath(rel)
    await mkdir(p, { recursive: true })
    await chown(p, 4001, 4001)
  }
  await Promise.all(
    ['datastore','archive','pins','block','blob','blobstage','tasks','decrees','logs',
     'customize','onlyoffice-conf']
      .map(ensureDir),
  )

  // Write generated config.js to subcontainer rootfs (ephemeral; regenerated each restart).
  // Bypasses docker-entrypoint.sh's [ ! -f "$CPAD_CONF" ] guard — verified
  // verbatim in upstream's docker-entrypoint.sh@main.
  await writeFile(
    `${appSub.rootfs}/cryptpad/config/config.js`,
    generateCryptpadConfig({
      httpUnsafeOrigin: new URL(store.mainUrl).origin,
      httpSafeOrigin:   new URL(store.sandboxUrl).origin,
      adminKeys:        store.adminKeys,
    }),
  )

  return sdk.Daemons.of(effects).addDaemon('primary', {
    subcontainer: appSub,
    exec: {
      command: sdk.useEntrypoint(),
      env: {
        // Required vars per docker-entrypoint.sh:
        //   CPAD_CONF redirects the entrypoint at our pre-written file
        //   (the file already exists, so the entrypoint's auto-generation
        //   branch is skipped entirely).
        CPAD_CONF:           '/cryptpad/config/config.js',
        // CPAD_MAIN_DOMAIN / CPAD_SANDBOX_DOMAIN are only used by the
        // entrypoint's sed substitution, which we bypass — but we set them
        // anyway for transparency in case anything else in the upstream
        // image scripts looks at them.
        CPAD_MAIN_DOMAIN:    new URL(store.mainUrl).origin,
        CPAD_SANDBOX_DOMAIN: new URL(store.sandboxUrl).origin,
        // CPAD_INSTALL_ONLYOFFICE intentionally NOT set — OnlyOffice was
        // installed at image-build time. Setting it to "yes" would re-run
        // the full ~210MB install on every container start.
      },
    },
    ready: {
      display: i18n('Web Interface'),
      fn: () =>
        sdk.healthCheck.checkWebUrl(effects, `http://localhost:${uiPort}/api/config`, {
          successMessage: i18n('CryptPad is ready'),
          errorMessage:   i18n('CryptPad is not ready'),
        }),
    },
    requires: [],
  })
})
```

`generateCryptpadConfig(...)` is a pure helper — same signature shape as the prior attempt's, but trimmed to v1's three inputs:

```typescript
function generateCryptpadConfig(c: {
  httpUnsafeOrigin: string
  httpSafeOrigin:   string
  adminKeys:        string[]
}): string {
  const adminKeysJs = c.adminKeys.map((k) => `    ${JSON.stringify(k)}`).join(',\n')
  return `/* CryptPad config — auto-generated by StartOS on every restart. Do not edit. */
module.exports = {
  httpUnsafeOrigin: ${JSON.stringify(c.httpUnsafeOrigin)},
  httpSafeOrigin:   ${JSON.stringify(c.httpSafeOrigin)},

  httpAddress:   '0.0.0.0',                 // upstream image's sed sets this; we preserve via CPAD_CONF override
  httpPort:      ${uiPort},                 // 3000
  httpSafePort:  ${UPSTREAM_HTTP_SAFE_PORT}, // 3001 — never reached externally; documented for clarity

  installMethod: 'docker',                  // upstream image's sed sets this; we preserve

  filePath:        '/data/datastore/',
  archivePath:     '/data/archive/',
  pinPath:         '/data/pins/',
  blockPath:       '/data/block/',
  blobPath:        '/data/blob/',
  blobStagingPath: '/data/blobstage/',
  taskPath:        '/data/tasks/',
  decreePath:      '/data/decrees/',
  logPath:         '/data/logs/',
  logToStdout:     true,

  adminKeys: [
${adminKeysJs}
  ],
}
`
}
```

Notable omissions vs. the prior attempt's generator:

- No `websocketPort` — upstream default 3003 (locked decision #5).
- No `disableIntegratedEviction` — upstream default `false`, leave alone (locked decision #11).
- No `adminEmail`, `maxUploadSize`, `maxWorkerCount`, `restrictRegistration`, `allowEmbedding` — covered by `/admin/` panel.
- No `customize/application_config.js` write here — that lives in `initializeService.ts` (§7.2) on the volume, written once.

---

## 9. Actions — `startos/actions/`

Five actions, registered in `actions/index.ts`:

```typescript
export const actions = sdk.Actions.of()
  .addAction(setMainUrl)
  .addAction(setSandboxUrl)
  .addAction(showSetupTokenUrl)
  .addAction(addAdminKey)
  .addAction(runDiagnostics)
```

### `utils.ts` additions

```typescript
import { T } from '@start9labs/start-sdk'

export async function getMainUrls(effects: T.Effects): Promise<string[]> {
  return sdk.serviceInterface
    .getOwn(effects, 'ui', (i) => i?.addressInfo?.nonLocal.format() || [])
    .const()
}

export async function getSandboxUrls(effects: T.Effects): Promise<string[]> {
  return sdk.serviceInterface
    .getOwn(effects, 'sandbox', (i) => i?.addressInfo?.nonLocal.format() || [])
    .const()
}
```

(Modelled on `ghost-startos/startos/utils.ts:7-12`.)

### 9a. Set Main URL — `actions/setMainUrl.ts`

| Field | Value |
|---|---|
| `id` | `'set-main-url'` |
| `allowedStatuses` | `'any'` (so it can be re-run after the service is running, to switch URL) |
| `visibility` | `'enabled'` |
| Input | `Value.dynamicSelect` — values from `getMainUrls(effects)` |
| Prefill | Current `store.mainUrl` (or `undefined` for first install) |
| Handler | `storeJson.merge(effects, { mainUrl: input.url })`. Reactive `setup.ts` clears the task. |

Pattern lifted from `ghost-startos/startos/actions/setPrimaryUrl.ts` — same `dynamicSelect`-from-helper, same prefill-and-merge handler shape.

### 9b. Set Sandbox URL — `actions/setSandboxUrl.ts`

Identical shape to 9a, except: id `'set-sandbox-url'`, helper `getSandboxUrls`, persists to `store.sandboxUrl`. This is the **only** way for the user to choose the sandbox URL because the sandbox interface is `type: 'api'` and therefore not clickable in the StartOS launcher.

### 9c. Show Setup Token URL — `actions/showSetupTokenUrl.ts`

| Field | Value |
|---|---|
| `id` | `'show-setup-token-url'` |
| `allowedStatuses` | `'only-running'` (decree log only exists after the daemon has run) |
| `visibility` | `'hidden'` (surfaced via the `setup-token-pending` task) |
| Input | None — `Action.withoutInput` |
| Result | `{ type: 'single', value: '<url>', copyable: true, qr: true, masked: false }` |

#### Decree-log parsing

Extract token from `/data/decrees/decree.ndjson`. Verified shape from `lib/api.js@main`:

```javascript
["ADD_INSTALL_TOKEN", [token], "", +new Date()]
```

NDJSON, one decree per line. *(Phase-2 update, 2026-05-09: there is no removal decree — see §13 question 2 resolution. Setup is "done" iff any `ADD_ADMIN_KEY` decree exists in the log. The implementation matches the resolved shape, not the speculative `RM_`-scan described in this section.)*

Shared helper (used by both `setup.ts` and `showSetupTokenUrl`):

```typescript
type SetupState = 'waiting-for-daemon' | 'pending' | 'done'

export async function isSetupPending(effects: T.Effects): Promise<SetupState> {
  const path = sdk.volumes.main.subpath('decrees/decree.ndjson')
  let raw: string
  try { raw = await readFile(path, 'utf-8') } catch (e: any) {
    if (e?.code === 'ENOENT') return 'waiting-for-daemon'
    throw e
  }
  if (raw.trim() === '') return 'waiting-for-daemon'

  const lines = raw.split('\n').filter(Boolean)
  let liveToken: string | null = null
  for (const line of lines) {
    let parsed: unknown
    try { parsed = JSON.parse(line) } catch { continue }   // skip malformed lines
    if (!Array.isArray(parsed) || parsed.length < 2) continue
    const [verb, args] = parsed as [string, unknown[]]
    if (verb === 'ADD_INSTALL_TOKEN' && Array.isArray(args) && typeof args[0] === 'string') {
      liveToken = args[0]
    } else if (verb.startsWith('RM_') && Array.isArray(args) && args[0] === liveToken) {
      liveToken = null
    }
  }
  return liveToken === null ? 'done' : 'pending'
}
```

Action handler:

```typescript
const state = await isSetupPending(effects)
const mainUrl = await storeJson.read((s) => s.mainUrl).once()

switch (state) {
  case 'waiting-for-daemon':
    throw new Error(i18n(
      'The CryptPad daemon hasn\'t bootstrapped yet. Wait ~30 seconds and retry.',
    ))
  case 'done':
    throw new Error(i18n(
      'Setup is already complete — your admin account exists. Use the /admin/ panel for further configuration.',
    ))
  case 'pending':
    if (!mainUrl) {
      // 'only-running' availability + daemon-start gate make this unreachable;
      // belt-and-suspenders.
      throw new Error('Main URL is not set; cannot construct setup URL.')
    }
    return {
      version: '1',
      title: i18n('CryptPad Setup URL'),
      message: i18n(
        'Open this URL in a browser to create your administrator account. ' +
        'The URL is single-use — once you complete the wizard, it is no longer valid.',
      ),
      result: {
        type: 'single' as const,
        value: `${mainUrl.replace(/\/$/, '')}/install/#${liveToken /* from helper */}`,
        copyable: true,
        masked:   false,
        qr:       true,
      },
    }
}
```

(In the actual implementation the helper would return the live token alongside the state, not just a discriminator — sketched above for plan readability.)

### 9d. Add Administrator by Public Key — `actions/addAdminKey.ts`

| Field | Value |
|---|---|
| `id` | `'add-admin-key'` |
| `allowedStatuses` | `'any'` |
| `visibility` | `'enabled'` |
| Input | `Value.list(Value.text(...))` — list of strings, accepts bare key OR `[user@host/key]` format |
| Prefill | Current `store.adminKeys` |
| Handler | Parse each entry → key only → dedupe → `storeJson.merge(effects, { adminKeys })` |

#### Parser (corrected vs. prior)

```typescript
function extractKey(raw: string): string {
  const trimmed = raw.trim()
  // Profile-link format:  [name@host:port/keyValue=]   or   [name@host/keyValue=]
  // The key portion is the trailing segment after the last `/` and before `]`,
  // base64 OR base64url (so the char class accepts +/_-).
  const m = trimmed.match(/^\[[^\]]*?\/([A-Za-z0-9+/_\-]+=*)\]$/)
  if (m) return m[1]
  // Bare-key form
  if (/^[A-Za-z0-9+/_\-]+=*$/.test(trimmed)) return trimmed
  throw new Error(`Invalid admin key: ${raw}`)
}
```

The prior attempt's regex was `[A-Za-z0-9+/]+=*` — which silently rejected base64url variants (`-_` instead of `+/`). v1 widens the char class. CryptPad keys observed in the wild have used both forms.

#### Removing keys

This action is the only mechanism for *removing* admin keys via StartOS: open the action, the prefilled list shows current keys, delete the row(s) you want gone, submit. The handler writes the resulting list verbatim — anything not in the input is removed. README's "Actions" section must spell this out so users don't expect a dedicated "Remove Admin" action.

The **day-to-day** path for managing admins remains CryptPad's in-app `/admin/#support` panel; this StartOS action is for first-admin emergency access (in case the install-token URL was missed) and bulk add/remove from outside the running app.

### 9e. Run Diagnostics — `actions/runDiagnostics.ts`

| Field | Value |
|---|---|
| `id` | `'run-diagnostics'` |
| `allowedStatuses` | `'only-running'` |
| `visibility` | `'enabled'` |
| Input | None |
| Result | `{ type: 'single', value: '<mainUrl>/checkup/', copyable: true, qr: false, masked: false }` |

Description text (English; translated to the four other locales in the i18n dictionary):

> Open this URL in a browser to run CryptPad's built-in self-diagnostic tests. Use this to verify your install is correctly configured or to troubleshoot issues. Some tests (e.g. "support help-desk not initialized," "embedding disabled") fail by design until you turn the corresponding feature on in `/admin/` — those failures are not a problem.

Defensive fallback: if `mainUrl` is null (cannot happen given `'only-running'` + daemon-start gate, belt-and-suspenders), throw with a clear message.

---

## 10. Health check

Single check on the `primary` daemon:

```typescript
ready: {
  display: i18n('Web Interface'),
  fn: () => sdk.healthCheck.checkWebUrl(
    effects,
    `http://localhost:${uiPort}/api/config`,          // ← /api/config, not /
    {
      successMessage: i18n('CryptPad is ready'),
      errorMessage:   i18n('CryptPad is not ready'),
    },
  ),
}
```

`/api/config` is the same endpoint CryptPad's own client UI fetches during boot — the canonical application-defined readiness signal. A successful 200 here means: the Node server is up, the config has parsed, and the API surface is responding. Stronger than `checkPortListening` (the port can be open before the app is actually serving) and stronger than a bare `/` (which would 200 even from a half-initialised server.

**Drop** all four extra health checks from the prior attempt: `admin`, `checkup`, `sandbox-security`, `onlyoffice`. Once `/api/config` is 200, the daemon is ready; spurious failures are the only thing the others can produce. If a user hits an issue with admin/checkup/onlyoffice, the **Run Diagnostics** action surfaces CryptPad's own `/checkup/` page which does a much more thorough job than any of those bespoke health checks.

---

## 11. Backup — `startos/backups.ts`

```typescript
export const { createBackup, restoreInit } = sdk.setupBackups(
  async ({ effects }) => sdk.Backups.ofVolumes('main'),
)
```

No exclusions. No pre/post hooks. Build-time OnlyOffice means `/cryptpad/www/common/onlyoffice/dist` lives in the image rootfs — not on the volume — so there is nothing to exclude. (Prior attempt's `withOptions({ exclude: ['onlyoffice/dist'] })` was correct *for its design* but unnecessary in v1's design.)

### Restore behaviour — preserved across restore

| Item | Mechanism | Why preserved |
|---|---|---|
| Document data, blobs, pins, blocks | `/data/{datastore,blob,blobstage,pins,block}` are on volume | Volume snapshot |
| `loginSalt` | `/data/customize/application_config.js` is on volume; `initializeService.ts`'s file-existence guard prevents re-salting | User passwords still hash correctly post-restore |
| Existing admin keys | `/data/store.json` is on volume | Admin keys regenerated into post-restore `config.js` |
| Install-token state | `/data/decrees/decree.ndjson` is on volume | "Show Setup Token URL" reports "setup already complete" instead of generating a new token |

The `loginSalt` write-once guard in §7.2 is **load-bearing** for restore correctness. If anyone refactors §7.2 in the future, that guard must stay. Tests in §14 verify it (test 13a "post-restore login works").

---

## 12. Prior Attempt Audit

For each file in `~/myworkspace/cryptpad-startos-prior/`, classified KEEP / KEEP-with-update / UPDATE / REWRITE / REPLACE / DROP. References to the prior attempt cite the path under that directory unless otherwise noted.

### Build & plumbing (KEEP / minor updates)

| Path | Verdict | Notes |
|---|---|---|
| `Makefile` | **KEEP** | `ARCHES := x86 arm` matches our two-arch shape. |
| `s9pk.mk` | **KEEP** | Plumbing; `# DO NOT EDIT` honoured. |
| `package.json` | **KEEP, bump SDK** | Bump `@start9labs/start-sdk` to current 0.4.0-beta.* (prior pinned `^0.4.0-beta.61` — pick the latest beta during Phase 2). |
| `package-lock.json` | **REGENERATE** | After `package.json` SDK bump. |
| `tsconfig.json` | **KEEP** | Standard; nothing to change. |
| `.gitignore` | **KEEP** | Already correct. |
| `.dockerignore` | **KEEP, expand** | Currently `\.git\n.gitmodules` — both still relevant since we're keeping `.git` out of the build context. |
| `.gitmodules` | **DROP** | Vestigial cryptpad submodule (locked decision #4). |
| `cryptpad/` (submodule path) | **DROP** | Same. |
| `.github/workflows/buildService.yml`, `releaseService.yml` | **KEEP** | Unchanged; CI still builds the wrapper from a `.s9pk` make target. |
| `assets/` | **KEEP** | Empty placeholder dir; will contain the icon SVG. |
| `assets/README.md` | **KEEP** | One-line README; preserve. |
| `CONTRIBUTING.md` | **KEEP** | Generic contribution guidance; preserve. |

### Top-level docs (REWRITE)

| Path | Verdict | Notes |
|---|---|---|
| `LICENSE` | **REPLACE** | Re-fetch AGPL-3.0 text from `cryptpad/cryptpad@v2026.2.2/LICENSE` for freshness. Prior was a symlink into the now-removed submodule. |
| `icon.svg` | **REPLACE** | Was a symlink into the removed submodule; replace with `assets/CryptPad_logo.svg` (re-fetched) and a real symlink/copy. |
| `README.md` | **REWRITE** | Good outline (Image, Volume, First-Run, Config, Network, Actions, Backups, Health Checks, Limitations, Unchanged, AI Quick Reference). v1 changes per §13 below. Drop concrete version numbers per `writing-readmes.md`. |

### `startos/manifest/` (UPDATE)

| Path | Verdict | Notes |
|---|---|---|
| `manifest/index.ts` | **UPDATE** | Switch `dockerTag: 'cryptpad/cryptpad:version-2026.2.0'` → `dockerBuild: {}`. Otherwise keep package id, repo URLs, donation URL, docsUrls. |
| `manifest/i18n.ts` | **UPDATE** | Keep `short` and `long` for all 5 locales (still accurate). Rewrite `alertInstall` per §2 (drop OnlyOffice 10–15-min line; drop Set Admin Keys mention; mention two-domain sandbox security; mention CryptPad has no email). |

### `startos/index.ts`, `startos/sdk.ts` (KEEP)

Both are pure plumbing files marked `DO NOT EDIT`. Keep verbatim.

### `startos/utils.ts` (UPDATE)

`uiPort = 3000`, `wsPort = 3003` — keep both. Add `getMainUrls` and `getSandboxUrls` helpers (§9 helpers). Keep the comment block explaining "no separate sandbox port."

### `startos/interfaces.ts` (REWRITE)

Four interfaces (ui, admin, checkup, sandbox) → two (ui, sandbox). Sandbox `type: 'ui'` → `'api'` per locked decision #1. `admin` and `checkup` deleted (path overlays via the actions and CryptPad's own UI, not separate launchers). The `ui-multi`/`sandbox-multi` MultiHost names and the "both bind `uiPort`" structure are **preserved verbatim** from the prior attempt — that part was correct.

### `startos/main.ts` (REWRITE — preserving load-bearing patterns)

**Preserve from prior:**

- The chown-4001 dance for pre-creating subdirectories (`cryptpad-startos-prior/startos/main.ts:60-73`).
- Writing `config.js` into `${appSub.rootfs}/cryptpad/config/config.js` and pointing at it via `CPAD_CONF` env var.
- The `IIFE module factory` shape used to write `customize/application_config.js`. (Move usage into `initializeService.ts`; the wrapper text is unchanged.)
- The `useEntrypoint()` daemon command shape.

**Drop:**

- The tier-based URL picker (`pickUrlWithTier`, `TieredUrl`) — locked decision #12 says no auto-defaulting.
- `CPAD_INSTALL_ONLYOFFICE: 'yes'` env var — OnlyOffice baked into image.
- Four extra health checks (`admin`, `checkup`, `sandbox-security`, `onlyoffice`) — keep only `primary` with `/api/config` endpoint.
- `same-origin fallback` (`mainOrigin === sandboxOrigin` branch) — both URLs are required, no fallback.
- All store fields except `adminKeys`, `mainUrl`, `sandboxUrl`.

**Add:**

- The defensive `throw` if either URL is null (§7.4).
- The `taskPath` override.
- The `customize/` and `onlyoffice-conf/` subpath mounts (subpath of `main`, not separate volumes).

### `startos/init/index.ts` (REWRITE)

Single combined `lifecycleTasks` `setupOnInit` → three separate `setupOnInit`s (`seedFiles`, `initializeService`, `setup`). Re-order init args per §7.

### `startos/install/versionGraph.ts` (KEEP)

Plumbing. Two-line file. Keep.

### `startos/install/versions/` (REPLACE)

| Old path | Action |
|---|---|
| `v2026.2.0.0.a0.ts` | Delete. |
| `v2026.2.0.0.ts` | Delete. (Prior had a non-alpha; v1 starts back at alpha because of the breaking architecture changes.) |
| `index.ts` | Replace with `current = v2026_2_2_0_a0; other = []`. |

New file: `v2026.2.2.0.a0.ts` with the standard template (`migrations: { up: noop, down: IMPOSSIBLE }`) and v1 release notes (English + 4 locales). Per `versions.md` "When to Create a New Version File" — alpha→stable promotion within v2026.2.2 is rename-in-place; we only create new files when there's a real migration step.

### `startos/dependencies.ts` (KEEP)

Empty `setupDependencies(async () => ({}))`. Keep.

### `startos/backups.ts` (UPDATE)

Drop `withOptions({ exclude: ['onlyoffice/dist'] })`. New body is one-liner `sdk.Backups.ofVolumes('main')` per §11.

### `startos/fileModels/` (UPDATE)

`store.json.ts`: replace 8-field shape with the 3-field shape in §3. Keep `FileHelper.json` import shape and the `subpath: 'store.json'` location.

`fileModels/README.md`: keep but update if it documents specific fields that no longer exist.

### `startos/actions/` (REWRITE)

Old: `setAdminKeys`, `setInstanceConfig`. New: five actions per §9 (`setMainUrl`, `setSandboxUrl`, `showSetupTokenUrl`, `addAdminKey`, `runDiagnostics`). The `extractKey` parser pattern in `setAdminKeys.ts` is the only thing carried forward — with widened character class. Everything else is new.

### `startos/i18n/` (REPLACE)

Rebuild `dictionaries/default.ts` and `dictionaries/translations.ts` from scratch for v1 strings. The plumbing (`i18n/index.ts`) stays.

### `tests/` Playwright suite (KEEP, defer updates)

Locked decision says defer to v1.0. The old suite tests pad creation, drive, OnlyOffice editing, multi-URL access, etc. — all things we still want to verify, but with v1's two-task install flow they need a setup-wizard step before they can run, and their `.env` config schema may need updating. Punt to a separate v1.0 task.

### Summary of "wrong-for-current-design" items the brief enumerated

The 10 items the brief lists are addressed above. Mapping (for reviewer audit):

| Brief item | Section in this plan |
|---|---|
| 1. Sandbox `type: 'ui'` → `'api'` | §5 |
| 2. cryptpad git submodule | §12 (DROP), §4 (image strategy) |
| 3. Auto-LAN URL defaulting | §7.3 (no auto-default), §9a/9b (manual selection) |
| 4. Duplicative `store.json` fields | §3 (3-field schema), §6 (no SMTP) |
| 5. Four interfaces → two | §5 |
| 6. OnlyOffice runtime install → build-time | §4 |
| 7. Four extra health checks → one | §10 |
| 8. Port-3003 listed in README | §12 (README rewrite) |
| 9. `/admin/`, `/checkup/`, `/sandbox-security/` health checks | §10 |
| 10. `loginSalt` never written to volume | §7.2, §11 (restore implications) |

---

## 13. Open research questions — RESOLVED

The brief listed four open questions; each is now resolved with a citation. Plus the OnlyOffice/dist mount question:

| # | Question | Resolution | Source |
|---|---|---|---|
| 1 | Does CryptPad have any SMTP/email integration? | **No.** Open feature request, never implemented. | Upstream issue #1047; admin-guide installation docs make no mention of SMTP. |
| 2 | Is the sandbox interface a clickable user destination? | **No.** Type `'api'` — non-clickable in StartOS launcher; loaded automatically by main UI. | `recipe-api-interface.md`; `garage-startos/startos/interfaces.ts:11-21` precedent. |
| 3 | Does CryptPad need a separate WebSocket port externally? | **No.** Server on 3000 internally proxies `/cryptpad_websocket` to its own 3003. | `lib/http-worker.js@main` (`server.on('upgrade', wsProxy.upgrade)`); confirmed via WebFetch. |
| 4 | Where does the install-token URL come from? | The decree log at `decreePath/decree.ndjson`, format `["ADD_INSTALL_TOKEN", [token], "", timestamp]`. | `lib/api.js@main`; confirmed via WebFetch. |
| 5 | Does `customize/dist` need a volume mount? | **No.** Build-time install puts it in image rootfs, where it must stay (mounting an empty volume there shadows the populated content). | `install-onlyoffice.sh@main` writes to both `dist/` and `onlyoffice-conf/`; conf is state, dist is per-version assets. |

### New questions surfaced by research (to surface BEFORE Phase 2 writes code)

1. **`HealthReceipt.never` SDK construct** — the brief mentions this tentatively. I cannot confirm it exists from the local docs (`main.md` doesn't mention it) and the SDK source isn't installed in any local `node_modules` for me to grep. The plan currently uses a plain `throw new Error(...)` in `setupMain` (mirroring `vaultwarden-startos`). If the construct does exist and Jesse prefers it, it's a one-line swap during Phase 2.

2. **`RM_INSTALL_TOKEN` decree shape** — RESOLVED IN PHASE 2 (sideload, 2026-05-09): there is no removal decree. CryptPad never removes the `ADD_INSTALL_TOKEN` line from the log; the log just stays append-only. The "setup is done" signal is the *presence of any `ADD_ADMIN_KEY` decree* (emitted by the install wizard or by the in-app `/admin/` panel adding admins), not a paired removal. `decrees.ts` was updated to scan for `ADD_ADMIN_KEY` instead of `RM_*`. The `setup-token-pending` task severity was simultaneously dropped from `'critical'` → `'important'` because the original combination produced an unrecoverable startup deadlock when the parser stayed permanently stuck in 'pending'.

3. **First-character of admin keys** — CryptPad keys are normally URL-safe base64 (44 chars + `=`). Should the parser also strip whitespace inside the key, or is per-line trimming sufficient? Plan assumes per-line trim is enough; manual test case with surrounding whitespace will confirm.

If 1 and 3 turn out to need different handling than the plan currently has, both are localised edits in Phase 2 — neither alters anything else.

---

## 14. Build and test plan

### Build

```bash
# Once, on a fresh checkout:
make check-deps   # confirms start-cli, npm, jq present
make check-init   # creates ~/.startos/developer.key.pem if missing

# Both arches:
make
# Single arch:
make x86_64
make aarch64

# Output: cryptpad_x86_64.s9pk and/or cryptpad_aarch64.s9pk
```

### Sideload

Requires `host: http://<server>.local` in `~/.startos/config.yaml`.

```bash
make install
# OR explicitly:
start-cli package install -s cryptpad_x86_64.s9pk
```

### Manual test checklist (gate for `0-alpha.0` → `0`)

Run each on a real StartOS server with the latest sideloaded `.s9pk`. Pass criteria in italics.

**Install & gating**

1. Fresh install completes without error.  *Daemon does not start. Two `critical` tasks visible (Set Main URL, Set Sandbox URL). No Setup Token task yet. Service shows "Stopped — waiting on setup."*
2. Run **Set Main URL** action; pick the LAN URL.  *Daemon still does not start (Sandbox URL still null).*
3. Run **Set Sandbox URL** action; pick the LAN URL (different hostname from main).  *Daemon starts. Within ~30s a third `critical` task **Complete CryptPad Initial Setup** appears.* Verify on disk: `/data/decrees/decree.ndjson` contains an `ADD_INSTALL_TOKEN` line.
4. **Order independence**: tear down, reinstall, set Sandbox URL first then Main URL. *Same end state — daemon starts, setup-token task appears.*

**Setup-token flow**

5. Run **Show Setup Token URL** action.  *Returns a URL of form `https://<main-host>/install/#<token>`. URL is copyable and rendered as QR.*
6. Open the URL in a browser, run the wizard (admin email, password, instance customisation).  *Wizard succeeds. Account is created. Setup-token task clears (re-running the action returns "setup already complete").*
7. Sign in to the new admin account, navigate to `/admin/`.  *Admin panel loads with full controls.*

**Admin key action**

8. Run **Add Administrator by Public Key**.  Submit one bare key + one `[user@host/key]` profile-link.  *Both extract correctly. `config.js` regenerated; service restarts.* Open `/admin/`, verify the new keys appear in the admin list.
9. Re-open the action — the prefilled list shows both. Delete one row, submit. *Submitted list overwrites; deleted key is removed on the next restart.*
10. Submit a malformed key (e.g. random text). *Action fails with "Invalid admin key: …" and no merge happens.*

**Diagnostics & app**

11. Run **Run Diagnostics**. *URL `https://<main-host>/checkup/` returned.* Open in browser; verify: most tests pass; the documented expected-failures (support help-desk, embedding) fail by design and are documented as such in the README.
12. Create a rich-text pad, edit collaboratively from a second browser session, refresh, verify persistence.
13. Upload a file, download it back. *Round-trip works.*
14. Open .docx, .xlsx, .pptx via OnlyOffice (Document, Sheet, Presentation apps). *All three editors load and save correctly.*

**URL switching, restart, restore**

15. From the **Set Main URL** action, switch to a different reachable URL (e.g. mDNS → public domain). *Service restarts. New URL is the one shown in the launcher; old URL still works server-side because StartOS routes all hostnames to the same port.*
16. Stop / start the service. *All data persists. No re-setup required.*
17. Take a backup. Uninstall. Install fresh. Restore. **Critical** verification:
    - **17a.** Log in with a user account created pre-backup. *Login succeeds.* (Proves `loginSalt` was preserved on the volume.)
    - **17b.** Run **Show Setup Token URL** post-restore. *Returns "setup already complete" — does NOT issue a fresh install token.* (Proves the decree log was preserved.)
    - **17c.** Pre-backup admin keys still grant `/admin/` access. (Proves `store.json` was preserved.)

**StartOS UI presentation**

18. On the service page, confirm: exactly **one** clickable launch link (the `ui` interface). The `sandbox` interface appears in the listing with no clickable URL (per `type: 'api'`). The Donations link in the Links panel points to OpenCollective.

### Promotion gate

Passing all 18 items end-to-end is the gate for `:0-alpha.0` → `:0`. Any failure halts promotion until fixed; we do not ship a broken stable from a half-passing alpha.

---

## End of plan

Ready for review. After approval, Phase 2 is to scaffold the package per §1–§12 in the order: build/plumbing files (Makefile carry, package.json with bumped SDK, tsconfig) → manifest → versions → utils + upstream-defaults → fileModels → interfaces → init → actions → main → backups → README. Each commit a coherent unit; final commit message notes the v1 vs. prior-attempt deltas (loginSalt fix, sandbox `type: 'api'`, two-binding-on-3000, single health check, build-time OnlyOffice).
