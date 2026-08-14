# TODO — CryptPad on StartOS

Live worklist. Remove items as they're finished; add items when work is deferred.

## Alpha testing — v2026.5.1_0 (released 2026-08-10)

Released from commit `0ed28ba`, tag `v2026.5.1_0`.
Asset: `cryptpad_x86_64.s9pk`, sha256 `4f52abf463da5f37bf3307eee772e52039a737fea5d3e444660d142cd5fe1dbc`.
**x86_64 only** — aarch64 builds green on CI but was not shipped.

### Repo state that is NOT visible in the files

- **All three GitHub Actions workflows are disabled at the *settings* level**, not in the
  workflow files (`gh workflow list --all` shows `disabled_manually`). The files are kept
  deliberately: when Start9 forks this into `Start9-Community`, their pipeline needs them and
  runs them with their org secrets. Don't "fix" a non-running CI by editing `.github/`.
- **The repo has no Actions secrets.** The `DEV_KEY` secret was deleted 2026-08-14. If CI is ever
  re-enabled here, the shared build workflow falls through to `start-cli init-key` and signs with
  a throwaway key that differs run-to-run. To restore the previous behaviour, re-upload the
  *identity* key (a different key from the workspace `build.key.pem` that signs local builds):
  `gh secret set DEV_KEY -R JesseMarkowitz/cryptpad-startos < ~/.startos/id.key.pem`.
- **The aarch64 artifact from CI run 31250455537 expires ~2026-08-22** (14-day retention). After
  that, producing an arm binary means re-enabling the Build workflow and dispatching it, or
  installing `qemu-aarch64` binfmt locally.

### What testers were told

Interpreting their reports depends on knowing this. The release notes told them to:

1. **Trust the server's Root CA before installing.** Expect this to be the single most common
   report anyway — a fresh install looks broken without it, and the error names a port the user
   never typed. First question on any "documents don't render" report: did they trust the CA, or
   only click through the warning on the main URL?
2. **Export their drive first if coming from CryptPad on StartOS 0.3.x** — this is not an
   upgrade path.
3. Restore takes tens of minutes; both URL tasks re-fire after a restore; CryptPad answers only
   on the Main URL; `/checkup/` reports 51/55 by design.

### Feedback log

Record what testers actually hit, so the next release is driven by evidence rather than guesswork.

- **2026-08-14 — alpha testing closed with no issues to fix.** Testers reported no defects
  against `v2026.5.1_0`. None of the "likely first questions" below came back as an actual
  report, so they remain predictions, not observed behaviour — keep them as support notes rather
  than treating them as validated.

### Likely first questions, with answers already established

- *"Documents won't open / certificate error on a port I didn't type"* → Root CA not trusted.
  Browsers do not offer certificate exceptions for iframes. See README, "the Sandbox Iframe and
  the Root CA".
- *"Login says invalid username or password but I know it's right"* → they are on a non-Main
  origin. `customSalt()` falls back to `''` when the page has not initialised for this instance,
  deriving different keys. Not an account problem.
- *"The launch button opens the wrong address"* → known; `launchableAddress` has no knowledge of
  `store.mainUrl`. Mitigation is in `instructions.md`.
- *"Restore has hung"* → it has not; ~42 minutes for a near-empty instance is expected and is an
  upstream StartOS issue, not this package.

## Blocking release

- [x] ~~Run the manual test checklist in `NextSteps.md`~~ — **complete. All 18 items pass.**
      Four defects were found and fixed along the way (non-reactive decree read, `write after
      const` in the init watcher, admin-key length validation, and the silent action result),
      plus a number of documentation corrections. See the results log in `NextSteps.md`.

- [x] ~~Restore takes ~42 minutes~~ — **measured and isolated; not this package's defect.**
      A *fresh install* of the identical 480 MB `.s9pk` completes in **under one minute**, while
      restoring a near-empty instance took **~42 minutes** (24% at ~10 min, 44% at ~18 min, 90%
      at 37 min). Same image, same box, ~40x difference. That rules out the OnlyOffice bake and
      the image's ~16,583 small files as the cause — the cost is in the **restore path**, not in
      unpacking. Moved to the upstream section below. No package change warranted; the README and
      `instructions.md` tell users to expect a slow restore without blaming a cause.

- [x] ~~Final commit~~ — done. Two commits (`03275e6` the migration + fixes, `0ed28ba` the
      documentation from testing), tagged `v2026.5.1_0` and released.

## Verified locally

- x86_64 builds and packs clean at `2026.5.1:0` on start-sdk 2.0.9; `npm run check` green.
- **aarch64 verified on CI.** The `Build` workflow's `arm` leg completed green in 3m44s on a
  native `ubuntu-24.04-arm` runner (GitHub run 31250455537), producing `cryptpad_aarch64.s9pk`.
  It cannot be built on the maintainer's x86 dev box — there is no `qemu-aarch64` binfmt handler
  registered, so a cross-build fails at `exec /bin/sh: exec format error` before any package code
  runs. That is a local environment limit, not a package defect; CI is the real check. To build
  it locally anyway: `docker run --privileged --rm tonistiigi/binfmt --install arm64`, then
  `make arm`.

## Resolved decisions

- [x] **Cross-origin guard: keep `URL.origin`.** The open question was whether to require a
      different *hostname* rather than a different *origin*. Decision: keep the origin comparison.
      - Isolation genuinely holds — same-origin policy includes the port. Checklist #12–#14 ran
        collaborative editing, chat, file round-trips and all three OnlyOffice editors against a
        same-host/different-port pair with the sandbox working correctly.
      - Upstream's different-domain advice is about **reachability, not security**:
        `config.example.js` warns that "invasive networks may filter traffic going over abnormal
        ports". That argues for standard ports on public instances, not against port-based origin
        separation.
      - Tightening would break the most common StartOS deployment. On a LAN with no domain,
        StartOS assigns the two MultiHosts different ports on one hostname automatically;
        requiring distinct hostnames would force every LAN user to obtain a second domain to run
        CryptPad at all.
      - The copy is now accurate: docs were rewritten across five locales to separate the LAN case
        (different port suffices) from the domain case (subdomain, because of port filtering), so
        the code/copy mismatch that raised this question no longer exists.

- [x] **Reviewed CryptPad 2026.2.2 → 2026.5.1 for anything worth surfacing: nothing.**
      - **`config/config.example.js` is byte-identical between the two tags** — no new or removed
        config keys, so `upstream-defaults.ts` and `cryptpadConfig.ts` need no changes.
      - **No new admin settings.** 2026.5.0 is user-facing work: Diagram app on Drawio 29.6.7 with
        a sketch-mode default and theme switcher, private-message notifications, zh-Hant/zh-Hans
        locales, Form accessibility, contacts page. Nothing an administrator configures and
        nothing warranting a new StartOS action.
      - **2026.5.1** fixes office-app corruption, a TypeError on password change with the user
        registry enabled (the in-app "User Directory"), and dependency updates — all inherited by
        pinning 2026.5.1.
      - **SSO plugin upgrade notes are not applicable** — this package ships no CryptPad plugins.
      - **2026.5.0's upgrade notes require re-running `install-onlyoffice.sh`.** The Dockerfile
        runs it on every build against the pinned image, so correct assets are picked up by
        construction.
      - **No README/instructions changes.** Both already state that anything unlisted behaves as
        upstream, so enumerating upstream feature work would contradict that contract.

- [x] **Regression test for `parseSetupState` — done.** The pure parser moved to an import-free
      `startos/setupState.ts`, with `test/setupState.test.ts` covering a realistic boot log,
      the post-wizard `done` transition, missing/empty input, a truncated trailing line, rows
      whose args are a bare number (`PROOFS_MIGRATED`), last-token-wins, and non-decree JSON.
      Uses `node:test` with **no new devDependencies** — no Start9 package ships a test harness,
      and Node 22 strips types natively. `npm test` runs it. Fixtures are synthetic; never paste
      values from a live instance, since an install token grants first-admin creation.

- [x] **Keep the `5.2.1` version numbers in `README.md`.** Decided 2026-08-14. `writing-readmes.md`
      says no specific version numbers, but the rule exists because version references go stale —
      and these three are frozen history about the retired 0.3.x package, not a claim about this
      one. Removing them makes the upgrade-hazard warning vague. If a community reviewer flags
      them on ctrl-F, the answer is the sentence above; `instructions.md` keeps the numberless
      phrasing for end users.

## Community submission

- [ ] **Open the community PR and send the submission email.** Both decisions below are settled;
      this is the remaining action.

- [ ] **Include the 0.3.x upgrade path in the submission email.** Decided 2026-08-14: raise it
      with Start9 there rather than solving it in the package. The retired
      `Start9Labs/cryptpad-startos` (0.3.x `manifest.yaml`, CryptPad 5.2.1, six volumes: main,
      blob, block, customize, data, datastore) has no 0.4.0 successor, and this package cannot
      serve as one — different volume layout, ~4 years of upstream data-format drift, and an
      empty `up` migration. `canMigrateFrom` is derived and cannot be narrowed
      (`other: []` → `<=current`), so StartOS will treat this as a valid upgrade from 5.2.1 and
      run that empty migration.
      Ask Start9 to add CryptPad to the "Services with special handling" list in the 0.4.0
      update guide, alongside Ghost and Synapse, with export-then-reimport guidance. Documented
      defensively in `README.md` and `instructions.md` in the meantime.
      **Unverified** — nobody has run 0.3.5.1 → 0.4.0 with CryptPad installed. Do not assert a
      specific failure mode without testing it.

## Upstream (StartOS platform, not this package)

These are raised separately from the community submission (issues/PRs against
`Start9Labs/start-technologies`) and none of them block this package.

- [ ] **Restore is ~40x slower than a fresh install of the same package.** Measured on x86_64
      StartOS 0.4.0.1: fresh install of the 480 MB CryptPad `.s9pk` **< 1 minute**; restore of a
      near-empty backup of that same package **~42 minutes**, progressing steadily through an
      "unpacking" phase. The backup itself took seconds. Since installing the identical image is
      fast, the image is not the variable — something in the restore path is doing far more work,
      or doing it far less efficiently, than install. Worth profiling before filing: confirm it
      reproduces with a small non-CryptPad package to establish whether the cost scales with
      image size, file count, or is a fixed overhead. Found in v1 CryptPad testing (checklist
      #17 vs #4).

- [ ] **Investigate a StartOS PR adding a primary/preferred address to interfaces.** Today an
      interface is reachable at every enabled gateway address and the launch button picks one by
      heuristic: `InterfaceService.launchableAddress`
      (`start-os/web/ui/.../interfaces/interface.service.ts`) prefers public domain → WAN IPv4 →
      private domain → mDNS, biased by how the admin is currently reaching StartOS
      (`config.accessType` / `config.hostname`). A package has no way to say "this is the address
      I am configured for", so any service that pins a single origin — CryptPad
      (`httpUnsafeOrigin`), and to a lesser degree Ghost/Gitea/Synapse — can have the launcher
      send users somewhere the service rejects. Scope to investigate: whether this belongs as an
      optional field on `createInterface`, as an effect the package calls when its URL setting
      changes (so it tracks `store.mainUrl` reactively), or as a per-interface user preference in
      the Interfaces tab. Check whether the `recipe-primary-url.md` packages want it too before
      proposing. Found in v1 testing (checklist #15).

- [ ] **Investigate what it would take for CryptPad on StartOS to pass `/checkup/` test 54
      (HSTS).** Requires a `Strict-Transport-Security` response header carrying `max-age=<n>`;
      CryptPad's checkup reads it directly (`www/checkup/main.js`). The header must come from
      whatever terminates TLS, which on StartOS is the platform, not the container — so this is
      the same platform gap as the item above/below, but worth scoping separately because it may
      be satisfiable per-interface rather than globally. Questions: should HSTS be blanket for all
      service origins, opt-in per interface, or configurable with the max-age? Note the hazard —
      HSTS is sticky in browsers and pins a hostname to HTTPS for its max-age, which can lock
      users out of a `.local` address whose cert later changes, so a short max-age or explicit
      opt-in is probably required. Requested during v1 testing (checklist #11/#18).

- [ ] **StartOS does not emit `Strict-Transport-Security`.** Verified against the monorepo:
      the string appears nowhere in the Rust or TS source, and `add_security_headers`
      (`shared-libs/crates/start-core/src/net/static_server.rs`) sets only CSP and
      `X-Content-Type-Options`, on StartOS UI-origin responses. Because the OS terminates TLS at
      the platform edge and proxies plain HTTP to the container, **no service package can set
      HSTS** — CryptPad's `/checkup/` test 54 will fail on every StartOS install. Adding HSTS at
      the reverse proxy would fix it fleet-wide. Worth raising as an issue or PR against
      `Start9Labs/start-technologies`.

## Deferred

- [ ] **Bump to start-sdk 2.0.10 once it publishes to npm.** Deferred by decision 2026-08-14;
      re-checked that day and npm still shows 2.0.9 as latest. Currently pinned to 2.0.9, matching
      the rest of the Start9 fleet (lnd, cln, jitsi, bitcoin-core, mempool, btcpayserver,
      vaultwarden, ghost, home-assistant, nextcloud, ollama are all on 2.0.9). 2.0.10 exists in
      the monorepo but returns E404 on npm; its only substantive change is moving the default
      manifest `osVersion` floor from `0.4.0-beta.10` to `0.4.0`.
- [x] ~~`PLAN-v1.md` retained as a historical design document~~ — **removed 2026-08-14.** The
      package shipped and the checklist passed, so the v1 design doc no longer earned its place in
      a repo a community reviewer reads. Recoverable from git history if ever needed.

## Known expected behavior (not bugs — documented in README)

- `/checkup/` reports 51/55 on a freshly set-up instance. Tests 14 (support tickets), 34 (terms
  of service) and 36 (privacy policy) are optional `/admin/` settings; test 54 (HSTS) is a
  platform limitation. Full detail in `README.md`. Note that `embedding disabled` is **not**
  among them — an earlier revision of these docs claimed it was, and testing disproved it.
- OnlyOffice asset `HTTP_404`s during editor load (`plugins.json`, `themes.json`,
  `document_editor_service_worker.js`, one icon) are upstream-normal — `cryptpad.fr` returns 404
  for the same paths.
