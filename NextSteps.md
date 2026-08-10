# CryptPad on StartOS — manual test checklist

This is the release gate. The package builds green and packs clean, but neither proves
CryptPad *runs* — every item below has to be exercised against a real StartOS server.

Run each on a server with the current `.s9pk` sideloaded (`make install`). Pass criteria in
italics. Record what passed and what wasn't run; don't promote the package until the list is
clean.

## Results log

Run against a StartOS 0.4.0.1 server; package `2026.5.1:0` on start-sdk 2.0.9.

| # | Status | Notes |
|---|---|---|
| 1 | ✅ pass | Install clean; daemon did not start; both critical tasks shown. |
| 2 | ✅ pass | Main URL set. |
| 3 | ⚠️ pass after fix | Initially **failed** — the setup-token task never appeared. Root cause: `decrees.ts` read the decree log with a non-reactive `readFile`, so nothing re-ran the init watcher once the daemon created the file. Fixed by reading through `fileModels/decreeLog.ts` (`FileHelper.string`, reactive). Re-verified by sideloading as an update: the task appeared from the pre-existing log with no restart. Also corrected two wrong expectations in this checklist — the service does not auto-start once critical tasks clear, and the task is `important`, not `critical`. |
| 5 | ✅ pass | Token URL returned and matched the on-disk decree log. |
| 6 | ✅ pass | Wizard completed: account created, instance named/described/coloured, all applications selected. |
| 7 | ✅ pass | Admin panel loaded, all tabs walked. **Note:** reached by typing `/admin/` manually — check whether the in-app admin link appears in the user dropdown, possibly only after a reload. Not a defect, but worth confirming for the docs. |
| 11 | ✅ pass | 51/55. All four failures are expected and now documented accurately in `README.md` and `instructions.md`: tests 14 (support tickets), 34 (ToS), 36 (privacy policy) are optional `/admin/` settings; test 54 (HSTS) is a StartOS platform limitation the package cannot fix. The prior claim that `embedding disabled` fails was **wrong** — it passed — and has been corrected everywhere. |
| 8 | ⚠️ pass, copy fixed | Both key formats parsed correctly (Alice via profile-link, Bob via bare key) and both reached `/admin/`. Two UX defects found, both fixed: (a) the action's list is **empty on a fresh install despite a working wizard admin** — correct behavior, because CryptPad keeps two independent admin lists, but nothing said so; the description, `README.md`, and `instructions.md` now explain the split. (b) Submitting produced **no acknowledgement** — the handler returned void. It now returns the saved list plus a restart note. |
| 9 | ✅ pass | Deleting a row removed that admin from `config.js` and from `/admin/` after the restart; the wizard (decree-log) admin was correctly untouched. Prefill showed the saved list. |
| 10 | ❌ **fail → fixed** | A random string was **accepted**. `extractKey` validated the character set but not the length, so any alphanumeric string passed. Rewritten to mirror upstream `Keys.canonicalize`: exactly 44 chars, `-` unescaped to `/`, no `_`. Verified against the three real keys from this install plus 7 invalid forms. **Not a privilege-escalation** — `lib/env.js` filters malformed keys out of `Env.admins` — but it produced an unremovable junk row in `/admin/`, and a typo'd real key would have silently granted nothing. Also fixed: the result modal joined keys with newlines and rendered as one run-on blob; now a `group` result, one copyable row per key. |
| 10 (retest) | ✅ pass | Malformed key rejected with a clear error; result modal now lists each key as its own copyable row. Confirmed the remaining limit is inherent: validation is syntactic (format + length), matching upstream, and cannot verify an account exists. Documented in `README.md` and `instructions.md`. |
| 11 (retest) | ✅ pass | Re-run on the fixed build: **identical** 51/55 with the same four test numbers (14, 34, 36, 54). Reproducible, and matches the documented expectation exactly. Run after reverting the admin-key change, confirming `/checkup/` does not inspect the admin list. |
| 12 | ✅ pass | Rich-text pad created; collaborative editing from a second browser with a separate account; chat and comments on edits both worked; refresh preserved document and session. **Validates the WebSocket design** — `/cryptpad_websocket` proxied internally to 3003, never bound externally. |
| 13 | ✅ pass | Uploaded a folder, downloaded a file from within it. Exercises the redirected blob paths (`/data/blob`, `/data/blobstage`). |
| 14 | ✅ pass | `.docx`, `.xlsx`, `.pptx` all opened **almost immediately** — confirms the build-time OnlyOffice bake (no first-run download). Also opened `.odt` and `.ods`, which additionally exercises the x2t WASM converter beyond the native OOXML path. |
| 16 | ✅ pass | Full shutdown then start (also tried restart): pads still open, still logged in, uploaded folder intact. No re-setup required. |
| 15 | ⚠️ pass, limitation documented | URL switch applied correctly: new URL served, service restarted, open sessions kept working (reconnect → editing → saved) and only failed on reload. **But the StartOS launch button still opens the old address**, and CryptPad rejects it with *"This page can only be accessed via …"*, stalling at *Loading…*. Not fixable from the package — interfaces carry no primary/preferred-address concept, and `ghost-startos` (the recipe's reference for this pattern) exports an identical plain interface; Ghost simply doesn't reject other hostnames. Documented as a known limitation in `README.md` with user mitigation in `instructions.md`. |
| 18 | ✅ pass, docs corrected | Version reads `2026.5.1:0`; donation + marketing links present on the About tab; sandbox addresses mirror Web UI on a different port, as designed. Two doc corrections: (a) we claimed `type: 'api'` keeps the sandbox out of the *clickable list* — imprecise. It is excluded from the service-page **Open** control (`controls.component.ts` filters `i.type === 'ui'`) but the **Interfaces tab** lists and links every interface regardless of type. Corrected in `interfaces.ts`, `README.md`, `instructions.md`. (b) Instructions said the sandbox needs a different *hostname*; a different **port** is sufficient and is what StartOS does automatically on a LAN. Rewritten to separate the local case from the domain case — the different-hostname advice is about restrictive networks filtering unusual ports, not about isolation. **Resolved:** the missing description on the About tab is expected — `description.short`/`long` surface in the **marketplace listing**, where other services show theirs, not on an installed service's page. |
| 17 | ✅ **pass** | **17a** — both pre-backup accounts logged in normally → `loginSalt` survived. **17b** — no setup-token task or action present; logs show no install-token banner and no `NO_ADMIN_CONFIGURED` → decree log survived. **17c** — `config.js` admin and the decree-log admin both intact, the latter still removable in `/admin/` → `store.json` and the decree log both survived. Beyond the formal criteria: uploaded documents, edited pads, instance branding, and **chat history on the shared document** all survived. Notes: (i) restore reassigns ports so both URL tasks re-fire — correct behavior, now documented; (ii) restore took **~42 minutes**, tracked as a release blocker in `TODO.md`. |
| 4 | ✅ pass | **Order independence confirmed** — Sandbox URL set *before* Main URL reached the same end state: tasks cleared, service startable, setup-token task appeared after manual start. **Timing experiment:** fresh install of the same 480 MB `.s9pk` completed **start to finish in under one minute**, versus ~42 minutes to restore. That isolates the slow restore to the restore path, not our image — reclassified as an upstream StartOS item. **New finding:** on a fresh install the browser blocked the **sandbox** origin's certificate with no override option (error names the sandbox port while the address bar shows the main port). Browsers only offer certificate exceptions for top-level navigation, never for iframes, so an untrusted Root CA breaks CryptPad specifically. Earlier installs worked only because the sandbox origin's exception had already been accepted at its previous port. Documented in `README.md` and prominently in `instructions.md`. |

**aarch64 — settled.** Built green on CI (native `ubuntu-24.04-arm` runner, 3m44s, run
31250455537). Not buildable on the x86 dev box for want of a `qemu-aarch64` binfmt handler, so
the CI matrix is the verification of record.

**Memory — settled.** Measure with **`start-cli package stats`**, not the cgroup path or the
systemd log line: a user-initiated stop/start does not emit the `memory peak` line (that only
appeared on sideload teardown). Observed ~364 MiB steady-state, ~543 MiB peak. **No
`hardwareRequirements.ram` declared**, matching the whole fleet — nextcloud, bitcoind, jitsi,
mempool and vaultwarden all declare none. Figures recorded in `README.md` under Resource Usage.
As predicted, OnlyOffice editing is client-side and did not move server memory materially.

**Behavior confirmed during 8–10, worth knowing before test 17 (restore):** adding a key that is
already a decree-log admin *shadows* the removable `/admin/` entry rather than replacing it —
`commands.ADD_ADMIN_KEY` short-circuits when `Env.admins` already contains the key, so it never
reaches `adminsData`. Reversible by deleting the key from the action and restarting. The test
install currently has **every** admin sourced from `config.js`, so none are removable in
`/admin/`; that is expected, not a defect.

**Re-testing 10 on an install that already has the junk key:** the bad entry is still in
`store.json`, so it will prefill and now **block submission** until you delete that row. That is
the intended migration path — the error names the offending value. There is no cleanup
migration, because the package has never been released.

**Two defects found by reading service logs, not by any checklist item** (both fixed; neither
was visible from the UI):

1. `Canceled: write after const: store.json` — thrown out of `init` right after the wizard's
   `ADD_ADMIN_KEY` decree. `init/setup.ts` selected `wizardCompletedNotified` in its
   `.const(effects)` map and then wrote that same field, so the SDK cancelled the run as stale.
   The write landed and the latch held, so the notification did not double-fire — but every
   fresh setup logged an alarming error and aborted the remainder of that init pass. Fixed by
   dropping the latch from the reactive map and reading it with `.once()`.
2. `ready.gracePeriod` left at the 10s default while CryptPad takes ~8s to bind (the upstream
   entrypoint runs `npm run build` on every container start). Too thin — slower storage or
   aarch64 would flash a red failure on every restart. Raised to 60s.

Worth repeating for later runs: **read the service logs even when the UI looks green.** Both of
these were invisible from the StartOS UI.

Tests 1–2 were run against the pre-fix build. The fix does not touch that code path, and test 4
re-exercises install-and-gate from scratch, so they do not need a separate re-run.

**Install & gating**

1. Fresh install completes without error.  *Daemon does not start. Two `critical` tasks visible (Set Main URL, Set Sandbox URL). No Setup Token task yet. Service shows "Stopped — waiting on setup."*
2. Run **Set Main URL** action; pick the LAN URL.  *Daemon still does not start (Sandbox URL still null).*
3. Run **Set Sandbox URL** action; pick a URL on a **different hostname** from the Main URL (a subdomain is sufficient). *Both critical tasks clear and the service becomes startable.*

   **Then start the service manually.** It does not auto-start: a `critical` task blocks startup until it's cleared, and clearing it makes the service startable rather than starting it. Manual start here is correct behavior, not a defect.

   *Within ~30s of the daemon coming up, a third task — **Complete CryptPad Initial Setup** — appears at `important` severity. It is deliberately not `critical`, since the daemon can run without it (see the comment in `startos/init/setup.ts`).*

   Verify on disk that CryptPad emitted its install token:

   ```bash
   start-cli package attach cryptpad -n cryptpad-sub -- cat /data/decrees/decree.ndjson
   ```

   *Contains a line beginning `["ADD_INSTALL_TOKEN",[...`.*

   > **On hostnames vs. ports.** Two different ports on the same hostname *are* two different browser origins, and the cross-origin guard in `setMainUrl`/`setSandboxUrl` accepts them (it compares `URL.origin`, which includes the port). But upstream CryptPad treats same-host/different-port as a **local development** arrangement only — `config.example.js` says it "is not appropriate in a production environment where invasive networks may filter traffic going over abnormal ports," and directs production instances to a different domain. Test with two hostnames.

4. **Order independence**: tear down, reinstall, set Sandbox URL first then Main URL. *Same end state — both tasks clear, service starts, setup-token task appears.*

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
