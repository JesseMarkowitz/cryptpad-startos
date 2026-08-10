# TODO — CryptPad on StartOS

Live worklist. Remove items as they're finished; add items when work is deferred.

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

- [ ] **Final commit.** The tree has been iterated on dirty throughout testing, as intended.
      One clean commit once the maintainer is satisfied; `git reset --soft HEAD~N` to collapse
      any fixups.

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

## Needs a decision before community submission

- [ ] **Raise the 0.3.x upgrade path with Start9 in the submission email.** The retired
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

- [ ] **Bump to start-sdk 2.0.10 once it publishes to npm.** Currently pinned to 2.0.9, matching
      the rest of the Start9 fleet (lnd, cln, jitsi, bitcoin-core, mempool, btcpayserver,
      vaultwarden, ghost, home-assistant, nextcloud, ollama are all on 2.0.9). 2.0.10 exists in
      the monorepo but returns E404 on npm; its only substantive change is moving the default
      manifest `osVersion` floor from `0.4.0-beta.10` to `0.4.0`.
- [ ] `PLAN-v1.md` is retained as a historical design document. Once the checklist passes and
      the package ships, consider whether it still earns its place in the repo.

## Known expected behavior (not bugs — documented in README)

- `/checkup/` reports 51/55 on a freshly set-up instance. Tests 14 (support tickets), 34 (terms
  of service) and 36 (privacy policy) are optional `/admin/` settings; test 54 (HSTS) is a
  platform limitation. Full detail in `README.md`. Note that `embedding disabled` is **not**
  among them — an earlier revision of these docs claimed it was, and testing disproved it.
- OnlyOffice asset `HTTP_404`s during editor load (`plugins.json`, `themes.json`,
  `document_editor_service_worker.js`, one icon) are upstream-normal — `cryptpad.fr` returns 404
  for the same paths.
