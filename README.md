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
| Image source | Custom Dockerfile in repo root, built `FROM` the upstream `cryptpad/cryptpad` image |
| Architectures | x86_64, aarch64 |
| Runtime user | `cryptpad` (UID/GID 4001) |
| Entrypoint | Upstream entrypoint via `CPAD_CONF` env var |

> The upstream image tag is pinned in `Dockerfile`, and the package version in
> `startos/versions/current.ts` — those files and the service page are the sources of truth.
> `UPDATING.md` documents the bump procedure, the upstream tag-format quirks, and the list of
> upstream claims that must be re-verified on every version change.

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

CryptPad on StartOS requires **two origins** for full browser sandbox security: a *main* origin for the application and a *sandbox* origin for isolated document rendering. The browser uses the difference between the two to enforce sandbox isolation around document iframes.

An origin is scheme + host + port, so **two ports on one hostname already satisfy this** — which is what StartOS produces on a LAN with no extra setup, since the two MultiHosts get different external ports. Two distinct hostnames are only needed when serving over a domain, and for a different reason: upstream warns that restrictive networks filter traffic on unusual ports (`config/config.example.js`).

**Two critical tasks appear after install.** **Set Main URL** and **Set Sandbox URL** can be completed in either order. CryptPad will not start until both are set. Once both are done, the daemon starts and a third *important* task — **Complete CryptPad Initial Setup** — appears (informational; does not block startup).

The three-task flow:

1. **Set Main URL** — pick the URL users will open in their browser. Choose any reachable HTTPS URL StartOS exposes (LAN domain, mDNS, Tor, public domain).
2. **Set Sandbox URL** — pick a different *origin* for the sandbox iframe (a different port on the same hostname is sufficient; a different hostname is preferable when serving over a domain). The browser must see this as a different origin from the main URL for sandbox isolation to work. `setupMain` refuses to launch if the two URLs share an origin (the sandbox boundary would collapse), so this is enforced at startup as well as documented in the action copy.
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

### Complete CryptPad Initial Setup

| Property | Value |
|---|---|
| ID | `show-setup-token-url` (action ID retained for stable references; UI name is `Complete CryptPad Initial Setup`) |
| Availability | Any status |
| Visibility | Hidden — surfaced via the third *important* task on first install |
| Input | None |
| Output | URL of the form `https://<main-host>/install/#<token>` — **masked and copyable, no QR**. The token is a credential (it creates the first administrator on an instance that has none), so it follows the fleet's masked+copyable convention for secrets; the QR is omitted because rendering the same value as a scannable image would defeat masking the text. |

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
| Output | The saved key list, plus a note that CryptPad is restarting |

Manages the `adminKeys` array written into `config.js`. Each row in the list accepts either:

- a bare CryptPad public signing key (e.g. `CU6kIC-J4zPUqkXuWcxCApSvT4JkhpfBNbf13Mz+Vg4=`)
- the full profile format (e.g. `[username@instance.example.com/CU6kIC-J4zPUqkXuWcxCApSvT4JkhpfBNbf13Mz+Vg4=]`) — the action extracts the bare key from the full profile. This can be copied from CryptPad → Settings → Account → Public Signing Key

**Validation mirrors upstream `Keys.canonicalize`** (`src/common/common-signing-keys.js`): a key is exactly **44 characters** (43 base64 chars + `=`), and `-` is accepted as the escaped form of `/` — profile links escape `/` so the key survives embedding. The stored value is always the unescaped, canonical form, matching what CryptPad's own `Env.admins` holds. There is **no `_`** in this alphabet; upstream neither produces nor accepts base64url `_`.

Getting this wrong is quiet rather than loud. `lib/env.js` maps `config.adminKeys` through `Keys.canonicalize().filter(Boolean)` into `Env.admins` (the authorization list) but keeps the raw strings in `Env.adminsData` (what `/admin/` renders). A malformed key is therefore **dropped from authorization but still displayed** — it appears in the admin table as a row with a blank key and no Remove button. A v1 revision validated the character set but not the length, so any alphanumeric string was accepted; found in testing (checklist #10).

**To remove an administrator, delete the row and submit.** The list IS the new state, not a delta — anything not in the submitted list is removed from `config.js`'s `adminKeys` array on the next restart. There is no separate "Remove Admin" action.

This action is for first-admin emergency access (when the install-token URL was missed) and bulk add/remove from outside the running app.

#### The two administrator lists

CryptPad maintains administrators in **two independent places**, and this action reaches only one of them. Verified on a live install:

| Admin created by | Stored in | Appears in this action | Removable from `/admin/` |
|---|---|---|---|
| Setup wizard, or promoted in-app | Decree log (`ADD_ADMIN_KEY`, `/data/decrees/decree.ndjson`) | **No** | Yes |
| This action | `config.js` `adminKeys` array (from `store.json`) | Yes | **No** |

Upstream labels the second group in `/admin/` with its `admin_listHardcoded` string — *"Admin added into config.js. Can only be removed by editing the config file."* On StartOS the config file is generated, so the equivalent of "editing the config file" is re-running this action with the row deleted.

The practical consequence, and a reliable source of confusion: **on a fresh install this action's list is empty even though a working administrator already exists** (the wizard's). That is correct behavior, not a missing migration. The action's own description and `instructions.md` both spell this out; it was reported as a suspected bug during v1 testing before the copy was fixed.

Note the asymmetry when revoking: deleting a row here removes that key from `config.js` on the next restart, but has no effect on decree-log admins.

#### Putting the same key in both lists

Adding a key here that is *already* a decree-log admin makes the `/admin/` panel stop offering **Remove** for it. This is shadowing, not destruction, and it is reversible — the decree line is still in `decree.ndjson`.

The mechanism is a startup ordering effect. `lib/env.js` first seeds `Env.admins` / `Env.adminsData` from `config.adminKeys`. Decrees are replayed afterwards, and `commands.ADD_ADMIN_KEY` (`lib/decrees.js`) begins:

```js
if (Env.admins.includes(key)) { return false; }   // Nothing to change
Env.admins.push(key);
Env.adminsData.push(args[0]);
```

Because our `config.js` copy is already present, the decree short-circuits and never pushes to `adminsData`. The panel's `getAdminsData` builds its rows from `adminsData` and flags each one `hardcoded` when it also appears in `config.adminKeys` — so the only surviving row is the `config.js` one, which by definition renders without a Remove button.

**To undo it:** delete the key from this action's list and submit. On the next restart `config.js` no longer contains it, the decree replays normally, and the key returns as a removable admin.

#### What validation can and cannot check

Validation is **syntactic only** — format and length. It confirms the string is a well-formed Ed25519 public key; it cannot confirm that an account with that key exists. A typo'd key of the correct length is accepted and becomes an administrator entry that no one can ever use.

This is not a shortcut on our part — it is the ceiling. Upstream does exactly the same: both `commands.ADD_ADMIN_KEY` and the `/admin/` panel's own add-admin flow validate with `Keys.canonicalize` alone, and there is no existence check anywhere in the codebase. Nor could there sensibly be one: any 32 bytes is a syntactically valid public key, CryptPad is end-to-end encrypted, and the server holds opaque login blocks rather than a queryable account roster. Adding an admin key is best understood as "grant admin to whoever holds the private half of this key" — a statement about a keypair, not about a registered user.

### Run Diagnostics

| Property | Value |
|---|---|
| ID | `run-diagnostics` |
| Availability | Only when running |
| Visibility | Visible |
| Input | None |
| Output | URL pointing at `https://<main-host>/checkup/` |

Returns the URL of CryptPad's built-in `/checkup/` self-test. Open it in a browser to verify your install or troubleshoot.

Some `/checkup/` tests fail by design. On a freshly set-up instance with no admin content configured, 51 of 55 pass; the four failures are:

| Test | Reports | Why it fails | Fixable? |
|---|---|---|---|
| 14 | Encrypted support ticket functionality not enabled | Optional feature, off by default | Yes — `/admin/` → Support tab |
| 34 | No terms of service specified | Optional instance content | Yes — `/admin/` |
| 36 | No privacy policy specified | Optional instance content | Yes — `/admin/` |
| 54 | HSTS not required | StartOS terminates TLS at the platform edge and does not emit `Strict-Transport-Security`; CryptPad's server sees plain HTTP on port 3000 and cannot set it | **No** — see Limitations |

The first three are administrator choices, not defects — an instance that has configured them will pass. Test 54 cannot be fixed from inside the package.

The checkup also flags `/customize/application_config.js` as a customized asset. That is expected and load-bearing: it is where this package persists `loginSalt` (see [Volume and Data Layout](#volume-and-data-layout)).

## Backups and Restore

**Included in backup:** the entire `main` volume — all CryptPad data, the StartOS `store.json` (URLs and admin keys), the `customize/application_config.js` (containing `loginSalt`), the OnlyOffice install state in `onlyoffice-conf/`, and the decree log.

**Excluded:** nothing on the volume. (`/cryptpad/www/common/onlyoffice/dist/` is image rootfs — re-installed at image build, not a volume.)

**Changing the Main URL does not invalidate logins.** Verified against upstream: `Cred.deriveFromPassphrase` (`src/common/common-credential.js`) salts scrypt with `username + Cred.customSalt()`, and `customSalt()` returns `AppConfig.loginSalt` — the origin/hostname is not an input. This is precisely what `startos/init/writeLoginSalt.ts` exists to guarantee, and it is what makes both a URL change and a backup/restore survivable. Confirmed end to end in v1 testing: accounts created before a backup logged in normally after a restore that reassigned every port.

Note the failure mode when a user is at the *wrong* origin, because it is misleading: `customSalt()` falls back to `''` when `AppConfig.loginSalt` is not a string, so a page that has not fully initialised for this instance derives different keys from correct credentials. The user sees **"invalid username or password"** rather than an origin error. Documented for users in `instructions.md`.

**Restore reassigns ports, which re-fires both URL tasks.** A restored package gets new external ports, so the `mainUrl` / `sandboxUrl` saved in `store.json` no longer resolve. The watcher in `startos/init/setup.ts` compares the stored value against the live address list and raises `main-url-unavailable` / `sandbox-url-unavailable`. This is correct behavior, not a restore defect — the user re-picks the same hostnames with new ports and the daemon starts. Confirmed in v1 testing (checklist #17).

**Restore is slow — tens of minutes even for a near-empty instance**, against a backup that completes in seconds. This is *not* the OnlyOffice bake: a fresh install of the identical `.s9pk` finishes in under a minute, so the cost is in the restore path rather than in unpacking the image. Nothing in this package can shorten it; tracked as an upstream item in `TODO.md`. Users are warned in `instructions.md` that a restore takes a while and has not stalled.

**Restore behavior:** the volume is restored in place, then init runs with `kind === 'restore'` (which the SDK reports as `'install'` to package init code). The `customize/application_config.js` file already exists from the backup, so the file-existence guard in `startos/init/writeLoginSalt.ts` prevents `loginSalt` regeneration — and existing user passwords keep working. The decree log is also restored intact, so the install-token state is preserved (a finished install reports "already complete" rather than reissuing a fresh token).

## Health Checks

| Check | Method | Messages |
|---|---|---|
| Web Interface | HTTP GET `localhost:3000/api/config` | Success: "CryptPad is ready" / Error: "CryptPad is not ready" |

`/api/config` is the same endpoint CryptPad's own client UI fetches at boot — the canonical readiness signal. A 200 here means the Node server is up, the config has parsed, and the API surface is responding. Stronger than a port-listening check (the port can be open before the app is actually serving).

This is the **only** health check. An earlier iteration of this package had four extras (`admin`, `checkup`, `sandbox-security`, `onlyoffice`) — once `/api/config` returns 200 they all turn green and add no diagnostic value. If you need deeper inspection, use the **Run Diagnostics** action.

## Dependencies

None.

## Limitations and Differences

1. **No email integration.** CryptPad has no built-in SMTP support in any current release; account flows are end-to-end encrypted and local. The "support help-desk" feature uses CryptPad's own E2E-encrypted in-app messaging, not email. There is no StartOS SMTP action because there is nothing on the CryptPad side that would consume credentials. If a future CryptPad release adds SMTP, this package will revisit. (Upstream issue [#1047](https://github.com/cryptpad/cryptpad/issues/1047) tracks the open feature request.)
2. **Two URLs are required.** Without two distinct hostnames (different origins), CryptPad cannot start. Users on a single-domain setup will need to either provision a second hostname (e.g., a private domain in StartOS, or a Tor service) or configure the sandbox URL on the same hostname with a different subdomain prefix.
3. **`loginSalt` is set once and never changed.** Per upstream documentation, changing the login salt invalidates every existing user's password hash. The package writes it on first install and the file-existence guard in init prevents regeneration. Restoring a backup preserves the salt.
4. **`adminKeys` in `config.js` is one of two admin lists.** CryptPad's in-app `/admin/` panel maintains its own admin list internally; StartOS-managed `adminKeys` and in-app admins persist independently. The intended workflow is: use the install-token URL to create the first admin (wizard adds them in-app); use the StartOS action only for emergencies (lost access, no other admin available) or bulk operations.
5. **No HSTS headers.** HSTS is controlled by StartOS at the TLS-termination edge; service packages cannot configure it. Confirmed against the StartOS source: `Strict-Transport-Security` appears nowhere in the codebase, and the hardening headers the OS does apply (`add_security_headers` in `shared-libs/crates/start-core/src/net/static_server.rs`) set CSP and `X-Content-Type-Options` on StartOS UI-origin responses only. CryptPad's `/checkup/` **test 54** reports this — it does not affect functionality, and no package-side change can resolve it. Adding HSTS to the OS reverse proxy would be a platform-level improvement (see `TODO.md`).
6. **`x86_64` and `aarch64` only.** The upstream image does not publish `riscv64`.
7. **Single-node only.** Multi-node clustered CryptPad setups are not supported by this package.
8. **2FA recovery, password resets, support help-desk auto-init, public directory listing** — all live in the in-app `/admin/` panel; not exposed as StartOS actions.

## Known Limitation: Not an Upgrade Path from the 0.3.x CryptPad Package

**This package is a fresh install. It does not migrate data from the StartOS 0.3.x CryptPad service, and must not be presented as if it does.**

The retired package (`Start9Labs/cryptpad-startos`, still in 0.3.x `manifest.yaml` format) wraps **CryptPad 5.2.1** and stores data across **six separate volumes** — `main`, `blob`, `block`, `customize`, `data`, `datastore`, mounted under `/cryptpad/`. This package wraps a 2026 CryptPad release and uses **one** `main` volume with subdirectories under `/data`. Nothing maps across automatically, and the upstream gap is roughly four years of data-format history.

Three specific hazards:

1. **`canMigrateFrom` cannot be narrowed.** It is derived from the version graph, and `other: []` yields `<=current` — the widest possible range (`versions.md`, "canMigrateFrom Is Derived, Not Curated"). Because `5.2.1` sorts below this package's version, StartOS will regard this as a valid upgrade and run our `up` migration, **which is empty**. There is no supported way to make the platform refuse.
2. **Volume-name collision.** The old package also had a volume named `main`, holding CryptPad 5.2.1's `/cryptpad/main` contents — not the `store.json` / `datastore/` layout this package expects.
3. **Unverified.** Nobody has run this path on a real 0.3.5.1 → 0.4.0 migrated server. Treat it as unsupported rather than assuming a particular failure mode.

**Guidance for anyone coming from the old package:** export your pads from the running 0.3.x instance first (CryptPad's own drive export), then install this as a new service and re-import. Do not expect an in-place upgrade to carry documents over.

This is the same shape of problem StartOS's own [0.4.0 update guide](https://docs.start9.com/) calls out for Ghost and Synapse under "Services with special handling", and CryptPad arguably belongs on that list — see `TODO.md`.

## Known Limitation: the Sandbox Iframe and the Root CA

The two-origin design has a consequence that is easy to miss and looks like a broken package: **the sandbox origin needs a trusted certificate, and the browser will not let the user click through to get one.**

StartOS issues certificates for `.local`, IP and `.onion` addresses from the server's own Root CA (`start-os/docs/src/authorities.md`); third-party CAs will not issue for those. A browser that has not trusted that Root CA therefore warns on both of CryptPad's origins. For a single-origin service the user clicks *"Accept the risk and continue"* once and is done. That escape hatch **only exists for top-level navigation** — browsers do not offer certificate exceptions for subresources, and CryptPad loads its sandbox in an iframe.

The observed symptom is confusing in a specific way worth recognising: the address bar shows the **main** origin while the error names the **sandbox** origin (a different port), and there is no dismiss option. Seen on a fresh install in v1 testing (checklist #4) — an earlier install had worked only because the sandbox origin's certificate had already been accepted at its previous port.

Nothing in the package can fix this: the second origin is mandated by CryptPad's sandbox model, and certificate trust is a client-side decision. Mitigations are documented for users in `instructions.md`: trust the Root CA (the real fix — it survives restores and port changes and covers every other service), or grant the sandbox origin its own exception by opening it as a top-level page (a stopgap that must be repeated whenever ports change).

One trap worth knowing when explaining the stopgap: users must **click the address from the Interfaces tab**, not type it. A bare `host:port` in the address bar is parsed as a URI *scheme* plus path, and the browser offers to hand it to an external application ("no apps available") rather than loading a page — a failure that looks nothing like a certificate problem. Hit during v1 testing while following an earlier draft of these instructions.

This is a strong argument for using real domains with an ACME certificate on any instance with non-technical users.

## Known Limitation: the Launcher vs. CryptPad's Single-Origin Rule

StartOS's model is that a package declares *what* it exposes and the **user** decides *where* it is reachable — an interface is bound to every enabled gateway address at once (see `interfaces.md`). CryptPad breaks that assumption: it accepts exactly one origin (`httpUnsafeOrigin`) and rejects all others with *"This page can only be accessed via …"*, typically stalling at *Loading…* rather than redirecting.

The consequence is that **StartOS's launch button may open an address CryptPad rejects.**

The selection logic is `InterfaceService.launchableAddress` (`start-os/web/ui/.../interfaces/interface.service.ts`). It prefers, in order: public domain → WAN IPv4 → private domain → mDNS, and it biases toward the address family matching **how the user is currently reaching StartOS** (`config.accessType` / `config.hostname`). So an administrator browsing StartOS at `my-server.local` gets handed the `.local` CryptPad address — regardless of which URL was chosen as Main. The launcher has no knowledge of `store.mainUrl`, and no way to acquire any.

**There is no SDK mechanism to fix this.** Interfaces carry no notion of a primary or preferred address. The reference implementation for the changeable-URL pattern, `ghost-startos`, exports a plain interface exactly as this package does — but Ghost still *serves* on every hostname (its `url` setting only affects generated links), so the mismatch is invisible there. CryptPad is unusual in hard-rejecting.

Mitigation is documented in `instructions.md`: use the Main URL directly, or disable the unused addresses on the service's **Interfaces** tab so the launcher has only the correct one to offer.

Established sessions are unaffected by an origin change until reloaded — the WebSocket reconnects and edits continue to save. The rejection is a page-load check, not a per-request one. Confirmed in v1 testing (checklist #15).


## Known Limitation: Expected Log Noise

Three recurring log patterns are normal and should not be investigated as faults.

**1. `HTTP_404` on OnlyOffice assets while an editor loads.** Typically:

```
HTTP_404 /common/onlyoffice/dist/v9/document_editor_service_worker.js
HTTP_404 /common/onlyoffice/dist/v9/plugins.json
HTTP_404 /common/onlyoffice/dist/v9/themes.json
HTTP_404 /common/onlyoffice/dist/v9/web-apps/.../img/doc-formats/formats@2.5x.svg
```

The OnlyOffice bundle probes for optional files that CryptPad's trimmed distribution does not ship. **This is not an incomplete bake** — verified by requesting the same four paths from the upstream flagship instance `cryptpad.fr`, which returns 404 for all of them while `.../documenteditor/main/index.html` returns 200. CryptPad logs them at `INFO` for the same reason. Editors load and function normally.

**2. `Error while fetching URL: http://localhost:3000/api/config` + `ECONNREFUSED` at startup.** The `ready` health check polls once per second before the daemon binds its port. The upstream entrypoint runs `npm run build` on every container start (regenerating ~25 `www/*/index.html` files) before `node server.js`, so there is a several-second window where the port is closed. Expect a handful of these on every start; they stop the moment the server binds. The stack trace comes from `checkWebUrl` itself and cannot be suppressed from the package — `gracePeriod` governs the reported *status*, not the logging.

**3. `HK_GET_OLDER_HISTORY` with an all-zeros channel id.** History-keeper chatter, logged at `ERROR` by upstream but benign.

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

See [AGENTS.md](AGENTS.md) for how this repo is developed — it points at the StartOS packaging
guide's recipe index, which is the starting point for any change. [TODO.md](TODO.md) is the live
worklist, [NextSteps.md](NextSteps.md) is the manual test checklist that gates a release, and
[UPDATING.md](UPDATING.md) covers upstream version bumps.

Fork, branch from `master`, and open a pull request. Before submitting, `npm run check` and
`npm test` must both be green and `make` must pack cleanly.

`npm test` runs the decree-log parser's regression tests via `node --test` — no test framework
and no devDependencies, since Node 22 strips TypeScript types natively. The parser
(`startos/setupState.ts`) is deliberately import-free so it can be tested without the SDK; it is
the one piece of hand-rolled logic here that tracks an upstream format with no compatibility
guarantee, and `UPDATING.md` flags it as the highest-risk thing to re-verify on a version bump.

Tests live in `test/`, not beside the source. The SDK's build gate type-checks and lints
TypeScript under `startos/` only, and a test file there would have to satisfy both — which the
`.ts` import extension Node's resolver requires makes awkward. Keeping tests outside means they
are neither type-checked nor linted; running them is what validates them. See the note at the top
of `test/setupState.test.ts`.

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
