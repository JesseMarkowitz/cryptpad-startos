<p align="center">
  <img src="icon.svg" alt="CryptPad Logo" width="21%">
</p>

# CryptPad on StartOS

> **Upstream docs:** <https://docs.cryptpad.org/en/admin_guide/index.html>
>
> Everything not listed in this document should behave the same as upstream
> CryptPad. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable.

CryptPad is a privacy-first, end-to-end encrypted collaboration suite — documents, spreadsheets, presentations, whiteboards, kanban boards, and more, all encrypted in your browser before touching the server. See <https://cryptpad.org/> and the [upstream repo](https://github.com/cryptpad/cryptpad) for the full feature description.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Configuration Management](#configuration-management)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Actions (StartOS UI)](#actions-startos-ui)
- [Backups and Restore](#backups-and-restore)
- [Health Checks](#health-checks)
- [Dependencies](#dependencies)
- [Limitations and Differences](#limitations-and-differences)
- [What Is Unchanged from Upstream](#what-is-unchanged-from-upstream)
- [Building from Source](#building-from-source)
- [Contributing](#contributing)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

| Property | Value |
|---|---|
| Image source | Custom Dockerfile in repo root, `FROM cryptpad/cryptpad:version-X.Y.Z` |
| Architectures | x86_64, aarch64 |
| Runtime user | `cryptpad` (UID/GID 4001) |
| Entrypoint | Upstream entrypoint via `CPAD_CONF` env var |

The Dockerfile inherits the upstream `cryptpad/cryptpad` image and adds one layer: an OnlyOffice install (`./install-onlyoffice.sh --accept-license --trust-repository`) so the Document / Sheet / Presentation editors are available immediately on first start — no 10+ minute post-install download.

The container runs the upstream entrypoint, which we point at our generated `config.js` via `CPAD_CONF=/cryptpad/config/config.js`. Because that path already exists on every start (we pre-write it), the entrypoint's auto-generation branch is skipped entirely and the file is StartOS-managed end-to-end.

There is **no in-container reverse proxy**. CryptPad's Node server already emits the correct CSP/COEP/CORP headers; an in-container nginx/Caddy would duplicate them and break the browser-side security checks reported by `/checkup/`. StartOS terminates TLS at the platform layer.

## Volume and Data Layout

The `main` volume is mounted at three locations inside the container:

| Mount | Purpose |
|---|---|
| `/data` (volume root) | All persistent CryptPad data — documents, blobs, pins, blocks, decrees, logs |
| `/cryptpad/customize` | StartOS-managed `application_config.js` (contains `loginSalt`) |
| `/cryptpad/onlyoffice-conf` | OnlyOffice install state (per-version tracking) |

Directory layout under `/data`:

| Path | Contents |
|---|---|
| `/data/store.json` | StartOS state — `adminKeys`, `mainUrl`, `sandboxUrl`, `wizardCompletedNotified` (one-shot latch for the setup-complete notification) |
| `/data/datastore/` | Document data (`filePath`) |
| `/data/blob/`, `/data/blobstage/` | Encrypted file uploads (`blobPath`, `blobStagingPath`) |
| `/data/block/` | Authenticated user blocks (`blockPath`) |
| `/data/pins/` | User-pinned document references (`pinPath`) |
| `/data/archive/` | Archived data (`archivePath`) |
| `/data/tasks/` | Scheduled tasks (`taskPath`) |
| `/data/decrees/decree.ndjson` | Server-side decree log (`decreePath`) |
| `/data/logs/` | Activity logs (`logPath`) |
| `/data/customize/application_config.js` | Mounted to `/cryptpad/customize`. Contains `loginSalt` — written **exactly once** on first install and **never** regenerated, because changing the salt would invalidate every existing user's password hash |

`config.js` is generated from scratch on every restart and written to the container's ephemeral rootfs at `/cryptpad/config/config.js`. It's not on the volume and cannot be edited directly.

`/cryptpad/www/common/onlyoffice/dist/` (per-version OnlyOffice assets) lives in the image rootfs — refreshed when the image is rebuilt. It is **not** a volume mount; mounting an empty volume there would shadow the populated content baked in by the Dockerfile.

## Installation and First-Run Flow

CryptPad on StartOS requires **two domains** for full browser sandbox security: a *main* domain for the application and a *sandbox* domain for isolated document rendering. The browser uses the difference between the two origins to enforce sandbox isolation around document iframes.

**Two critical tasks appear after install.** **Set Main URL** and **Set Sandbox URL** can be completed in either order. CryptPad will not start until both are set. Once both are done, the daemon starts and a third *important* task — **Complete CryptPad Initial Setup** — appears (informational; does not block startup).

The three-task flow:

1. **Set Main URL** — pick the URL users will open in their browser. Choose any reachable HTTPS URL StartOS exposes (LAN domain, mDNS, Tor, public domain).
2. **Set Sandbox URL** — pick a *different* hostname for the sandbox iframe. The browser must see this as a different origin from the main URL for sandbox isolation to work. `setupMain` refuses to launch if the two URLs share an origin (the sandbox boundary would collapse), so this is enforced at startup as well as documented in the action copy.
3. **Complete CryptPad Initial Setup** — appears once the daemon has bootstrapped. Run the action to copy the install-token URL, open it in a browser, and complete the wizard to create your first administrator account, customize the instance, and (optionally) close registrations.

When the wizard finishes, the reactive watcher posts a one-shot **"CryptPad setup complete"** notification to the StartOS notifications panel — useful as a phone-ping confirmation if you walked away during the wizard. It fires exactly once per install (latched on the `wizardCompletedNotified` flag in `store.json`).

The install-token URL is single-use. Once you finish the wizard, the URL is consumed; running the action again reports "setup already complete" and points you at the in-app `/admin/` panel for further changes.

After this initial flow, day-to-day administration happens in CryptPad's own `/admin/` panel — see [Configuration Management](#configuration-management).

## Configuration Management

| Setting | Where it lives |
|---|---|
| Main URL (`httpUnsafeOrigin`) | StartOS — `Set Main URL` action |
| Sandbox URL (`httpSafeOrigin`) | StartOS — `Set Sandbox URL` action |
| Administrator keys (`adminKeys`) | Both — StartOS `Add Administrator by Public Key` action and CryptPad `/admin/#support` panel |
| Storage paths, ports, log destinations | Hardcoded in StartOS — pinned to `/data/*` and the upstream defaults |
| `loginSalt` | StartOS — written once on install, never changed |
| Instance name, description, custom branding | CryptPad in-app `/admin/` panel |
| Maximum upload size, registration toggle | CryptPad in-app `/admin/` panel |
| 2FA requirement, embedding toggle | CryptPad in-app `/admin/` panel |
| Applications enabled (Code, Kanban, etc.) | CryptPad in-app `/admin/` panel |
| Public directory listing | CryptPad in-app `/admin/` panel |

`config.js` is fully owned by StartOS — regenerated from `store.json` on every restart. Editing it inside the container is not supported; changes are overwritten on the next restart.

Settings stored in `store.json` (URLs, admin keys) trigger an automatic daemon restart so they take effect.

## Network Access and Interfaces

CryptPad uses **two `MultiHost` bindings**, both targeting container port 3000:

| Interface | Type | Internal Port | Purpose |
|---|---|---|---|
| `ui` | `ui` | 3000 | Main app, admin panel, checkup self-tests, WebSocket entry point |
| `sandbox` | `api` | 3000 | Internal iframe origin for document sandboxing |

The sandbox interface has `type: 'api'` — it does **not** appear as a clickable launcher in the StartOS UI. It's internal iframe machinery, loaded automatically by the main UI; users have no reason to open it directly. Its hostname is selected via the **Set Sandbox URL** action.

**Why two MultiHosts on the same container port?** CryptPad's browser sandbox model requires `httpUnsafeOrigin ≠ httpSafeOrigin` — the document sandbox iframe must load from a different *origin* so the browser's same-origin policy isolates it from the main app. StartOS gives each MultiHost a distinct hostname, while both bindings target port 3000 inside the container. CryptPad's HTTP server serves the same content regardless of the request's `Host` header; the browser is what enforces the sandbox boundary via origin difference. The CSP differentiation inside CryptPad is by URL path (e.g. `/api/`, OnlyOffice paths), not by host.

**WebSocket multiplex.** CryptPad's HTTP server on port 3000 intercepts upgrade requests for `/cryptpad_websocket` and proxies them internally to its own WebSocket server on port 3003. There is no separate external WebSocket port: the browser connects to `wss://main-host/cryptpad_websocket` over the StartOS-terminated TLS, StartOS routes to container port 3000, and CryptPad's HTTP server handles the proxy hop to port 3003 internally. Port 3003 is never bound externally.

## Actions (StartOS UI)

### Set Main URL

| Property | Value |
|---|---|
| ID | `set-main-url` |
| Availability | Any status |
| Visibility | Visible |
| Input | Dropdown of currently-reachable HTTPS URLs |
| Output | None |

Picks the URL CryptPad serves as its main app — what users open in their browser. The action lists every non-loopback HTTPS URL StartOS currently exposes for the `ui` interface; you pick one. Saved to `store.json` as `mainUrl`.

CryptPad will not start until both this and `Set Sandbox URL` are set. Re-run any time to switch the main URL after installation; the service restarts to pick up the new value.

### Set Sandbox URL

| Property | Value |
|---|---|
| ID | `set-sandbox-url` |
| Availability | Any status |
| Visibility | Visible |
| Input | Dropdown of currently-reachable HTTPS URLs |
| Output | None |

Picks the sandbox iframe origin — must be a *different* hostname from the Main URL for CryptPad's browser sandbox isolation to function. Both setter actions cross-validate against the current value of the other field and refuse to save a same-origin URL; `setupMain` keeps an identical check as a backstop. The action is the only mechanism for picking the sandbox URL because the sandbox interface is `type: 'api'` and not clickable in the StartOS launcher. Saved to `store.json` as `sandboxUrl`.

### Show Setup Token URL

| Property | Value |
|---|---|
| ID | `show-setup-token-url` |
| Availability | Any status |
| Visibility | Hidden — surfaced via the third *important* task on first install |
| Input | None |
| Output | URL of the form `https://<main-host>/install/#<token>` (copyable, with QR code) |

Reads CryptPad's decree log (`/data/decrees/decree.ndjson`) for the most recent `ADD_INSTALL_TOKEN` decree and constructs the corresponding `/install/#<token>` URL. Open the URL in a browser to run the install wizard (admin account creation, instance customization, application selection, registration policy).

The decree log lives on the volume, so the action can be invoked whether the service is running or stopped. If the daemon has never bootstrapped (no decree file yet), the action returns a clear "wait ~30 seconds and retry" message.

Once any `ADD_ADMIN_KEY` decree appears in the log (i.e., the wizard has completed, or an admin was added through the in-app `/admin/` panel), the action reports "setup already complete" and the third task auto-clears on the next reactive re-run of the init watcher. Use the in-app `/admin/` panel for any further configuration changes.

### Add Administrator by Public Key

| Property | Value |
|---|---|
| ID | `add-admin-key` |
| Availability | Any status |
| Visibility | Visible |
| Input | List of strings — each row is one administrator |
| Output | None |

Manages the `adminKeys` array written into `config.js`. Each row in the list accepts either:

- a bare CryptPad public signing key (e.g. `CU6kIC-J4zPUqkXuWcxCApSvT4JkhpfBNbf13Mz+Vg4=`), copied from CryptPad → Settings → Account → Public Signing Key
- the full profile-link format (e.g. `[username@instance.example.com/CU6kIC-J4zPUqkXuWcxCApSvT4JkhpfBNbf13Mz+Vg4=]`) — the action extracts the bare key from the link

The character class accepts both standard base64 and base64url variants — keys in the wild use both.

**To remove an administrator, delete the row and submit.** The list IS the new state, not a delta — anything not in the submitted list is removed from `config.js`'s `adminKeys` array on the next restart. There is no separate "Remove Admin" action.

This action is for first-admin emergency access (when the install-token URL was missed) and bulk add/remove from outside the running app. The day-to-day path for managing administrators is CryptPad's in-app `/admin/#support` panel — admins added via the install wizard or the in-app panel persist independently of the StartOS-managed `adminKeys` array.

### Run Diagnostics

| Property | Value |
|---|---|
| ID | `run-diagnostics` |
| Availability | Only when running |
| Visibility | Visible |
| Input | None |
| Output | URL pointing at `https://<main-host>/checkup/` |

Returns the URL of CryptPad's built-in `/checkup/` self-test. Open it in a browser to verify your install or troubleshoot.

Some `/checkup/` tests fail by design until you turn the corresponding feature on — `support help-desk not initialized` and `embedding disabled` are common examples. Those are user-toggle features in `/admin/`, not configuration errors. The action's description copy spells this out.

## Backups and Restore

**Included in backup:** the entire `main` volume — all CryptPad data, the StartOS `store.json` (URLs and admin keys), the `customize/application_config.js` (containing `loginSalt`), the OnlyOffice install state in `onlyoffice-conf/`, and the decree log.

**Excluded:** nothing on the volume. (`/cryptpad/www/common/onlyoffice/dist/` is image rootfs — re-installed at image build, not a volume.)

**Restore behavior:** the volume is restored in place, then init runs with `kind === 'restore'` (which the SDK reports as `'install'` to package init code). The `customize/application_config.js` file already exists from the backup, so the file-existence guard in `initializeService.ts` prevents `loginSalt` regeneration — and existing user passwords keep working. The decree log is also restored intact, so the install-token state is preserved (a finished install reports "already complete" rather than reissuing a fresh token).

## Health Checks

| Check | Method | Messages |
|---|---|---|
| Web Interface | HTTP GET `localhost:3000/api/config` | Success: "CryptPad is ready" / Error: "CryptPad is not ready" |

`/api/config` is the same endpoint CryptPad's own client UI fetches at boot — the canonical readiness signal. A 200 here means the Node server is up, the config has parsed, and the API surface is responding. Stronger than a port-listening check (the port can be open before the app is actually serving).

This is the **only** health check. The prior 0.4.0 attempt had four extras (`admin`, `checkup`, `sandbox-security`, `onlyoffice`) — once `/api/config` returns 200 they all turn green and add no diagnostic value. If you need deeper inspection, use the **Run Diagnostics** action.

## Dependencies

None.

## Limitations and Differences

1. **No email integration.** CryptPad has no built-in SMTP support in any current release; account flows are end-to-end encrypted and local. The "support help-desk" feature uses CryptPad's own E2E-encrypted in-app messaging, not email. There is no StartOS SMTP action because there is nothing on the CryptPad side that would consume credentials. If a future CryptPad release adds SMTP, this package will revisit. (Upstream issue [#1047](https://github.com/cryptpad/cryptpad/issues/1047) tracks the open feature request.)
2. **Two URLs are required.** Without two distinct hostnames (different origins), CryptPad cannot start. Users on a single-domain setup will need to either provision a second hostname (e.g., a private domain in StartOS, or a Tor service) or configure the sandbox URL on the same hostname with a different subdomain prefix.
3. **`loginSalt` is set once and never changed.** Per upstream documentation, changing the login salt invalidates every existing user's password hash. The package writes it on first install and the file-existence guard in init prevents regeneration. Restoring a backup preserves the salt.
4. **`adminKeys` in `config.js` is one of two admin lists.** CryptPad's in-app `/admin/` panel maintains its own admin list internally; StartOS-managed `adminKeys` and in-app admins persist independently. The intended workflow is: use the install-token URL to create the first admin (wizard adds them in-app); use the StartOS action only for emergencies (lost access, no other admin available) or bulk operations.
5. **No HSTS headers.** HSTS is controlled by StartOS at the TLS-termination edge; service packages cannot configure it. CryptPad's `/checkup/` test 52 reports this as a warning — does not affect functionality.
6. **`x86_64` and `aarch64` only.** The upstream image does not publish `riscv64`.
7. **Single-node only.** Multi-node clustered CryptPad setups are not supported by this package.
8. **2FA recovery, password resets, support help-desk auto-init, public directory listing** — all live in the in-app `/admin/` panel; not exposed as StartOS actions.

## What Is Unchanged from Upstream

- All CryptPad application features (documents, spreadsheets, presentations, kanban, whiteboard, code editor, forms, slides) work exactly as documented upstream.
- The `/admin/` panel works as documented once an administrator account exists.
- User registration, password reset, and account features work normally.
- Storage quotas, drive usage, and all CryptPad user-facing settings are unchanged.
- OnlyOffice editor integration is unchanged from upstream — only difference is install-time vs. first-run timing.
- The CryptPad federation API and inter-instance features are unchanged.

## Building from Source

```bash
make            # build for both x86_64 and aarch64
make x86_64     # single-arch
make aarch64
```

**Build-time network access required.** The Dockerfile runs `install-onlyoffice.sh` which fetches:

- `github.com/cryptpad/onlyoffice-builds.git` (git clone)
- Release archives from `github.com/cryptpad/onlyoffice-editor/releases/download/...`
- Release archives from `github.com/cryptpad/onlyoffice-x2t-wasm/releases/download/...`
- `raw.githubusercontent.com/ONLYOFFICE/web-apps/master/LICENSE.txt` (license-header curl, bypassed by `--accept-license` after the fetch)

Total payload added on top of the upstream image: ~210 MB. Offline builds are not supported in this version.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## Quick Reference for AI Consumers

```yaml
package_id: cryptpad
license: AGPL-3.0
architectures: [x86_64, aarch64]
volumes:
  main: /data
mounts:
  - main:/data
  - main/customize:/cryptpad/customize
  - main/onlyoffice-conf:/cryptpad/onlyoffice-conf
ports:
  ui: 3000          # main app + sandbox + WebSocket entry point
                    # NOTE: sandbox iframe binds the same container port via
                    # a separate MultiHost; browser sees a different origin.
                    # WebSocket /cryptpad_websocket is proxied internally to
                    # port 3003 by CryptPad — never bound externally.
interfaces:
  ui:      { type: ui,  binds_port: 3000 }
  sandbox: { type: api, binds_port: 3000 }   # not clickable in launcher
runtime_user: { uid: 4001, gid: 4001 }
dependencies: none
startos_managed_env_vars:
  - CPAD_CONF                # points at pre-written config.js
  - CPAD_MAIN_DOMAIN         # = httpUnsafeOrigin
  - CPAD_SANDBOX_DOMAIN      # = httpSafeOrigin
actions:
  - set-main-url
  - set-sandbox-url
  - show-setup-token-url     # hidden, surfaced via critical task
  - add-admin-key
  - run-diagnostics
health_checks:
  - http_get: http://localhost:3000/api/config
backup_volumes: [main]
backup_excludes: []
critical_tasks_on_install:
  - main-url-not-set         # → set-main-url
  - sandbox-url-not-set      # → set-sandbox-url
important_tasks_on_install:
  - setup-token-pending      # → show-setup-token-url (after both URLs set + daemon up)
```
