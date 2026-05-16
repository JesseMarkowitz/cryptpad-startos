# CryptPad

CryptPad on StartOS requires **two distinct domains** — a *main* domain for the app and a *sandbox* domain for the document iframe. The browser uses the difference between the two origins to enforce sandbox isolation around document rendering, so you must have two reachable hostnames before CryptPad can start.

## Documentation

- [CryptPad Admin Guide](https://docs.cryptpad.org/en/admin_guide/index.html) — the upstream guide for instance configuration, the `/admin/` panel, and ongoing operation.

## What you get on StartOS

- A privacy-first collaboration suite — documents, spreadsheets, presentations, whiteboards, kanban boards, code editor, forms — all encrypted in your browser before touching the server.
- The OnlyOffice editors (Document, Sheet, Presentation) are baked into the image, so first load is immediate; there is no 10–15 minute post-install download.
- All persistent data — pads, blobs, pins, blocks, the decree log, and your `loginSalt` — lives on the `main` volume and is included in StartOS backups.

## Getting set up

You will see two **Set URL** tasks the moment the install completes. Both must be done before CryptPad will start.

1. **Run the *Set Main URL* action.** Pick the URL users will open in their browser. This is the primary CryptPad address.
2. **Run the *Set Sandbox URL* action.** Pick a *different* hostname for the sandbox iframe — the browser must see it as a separate origin. If you only have one StartOS domain, provision a second (a different LAN domain, a Tor address, or a clearnet subdomain on a different host) before continuing.
3. **Wait ~30 seconds.** Once both URLs are set, CryptPad starts. A third task — *Complete CryptPad Initial Setup* — appears with the install-token URL.
4. **Run the *Complete CryptPad Initial Setup* task.** It returns a single-use URL that opens the install wizard in your browser. Create your first administrator account, customize the instance, and decide whether to leave registration open. The task auto-clears once the wizard finishes.

## Using CryptPad

### Web interface

The main URL opens straight into CryptPad — anonymous users land on the welcome page; signed-in users land in their drive. The sandbox URL is internal iframe machinery and is not a place you visit directly; it does not appear as a clickable launcher.

Day-to-day instance configuration — instance name, custom branding, registration toggle, maximum upload size, application list, support help-desk, public directory listing, 2FA requirements — lives in CryptPad's own `/admin/` panel, reachable from the user dropdown once you sign in as an administrator.

### Actions

- **Set Main URL** — change the primary CryptPad URL at any time. CryptPad restarts to pick up the new value.
- **Set Sandbox URL** — change the sandbox iframe URL. Must remain a different hostname from the Main URL.
- **Add Administrator by Public Key** — manage the administrator list maintained in CryptPad's `config.js`. Each row accepts either a bare public signing key (copied from CryptPad → Settings → Account → Public Signing Key) or the full `[user@host/key=]` profile-link format. The list IS the new state — to remove an administrator, delete its row and submit. Use this for first-admin emergency access if you missed the install-token URL, or for bulk add/remove from outside the running app. Administrators added through the install wizard or the in-app `/admin/` panel persist independently.
- **Run Diagnostics** — returns the URL of CryptPad's built-in `/checkup/` self-test. Open it in a browser to verify your install. A few tests fail by design until you turn the corresponding feature on in `/admin/` (`support help-desk not initialized`, `embedding disabled`); those are user-toggle features, not configuration errors.

## Limitations

- **No email integration.** CryptPad has no built-in SMTP support in any current release. Account flows are end-to-end encrypted and local; the "support help-desk" feature uses CryptPad's own in-app messaging, not email. There is no SMTP action because there is nothing on the CryptPad side that would consume credentials.
