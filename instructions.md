# CryptPad

> [!IMPORTANT]
> **Before you start: CryptPad needs two addresses, not one.** A *main* address for the app and a separate *sandbox* address for the document iframe. The browser uses the difference between the two origins to isolate document rendering, so CryptPad will not start until both are set.
>
> **On a local network there is nothing to arrange** — StartOS gives the two interfaces different ports on the same hostname, and a different port is already a different origin. **If you are serving CryptPad over a domain**, plan for two hostnames (typically a subdomain for the sandbox), because unusual ports are often filtered on restrictive networks. See [Getting set up](#getting-set-up) below.

> [!WARNING]
> **Trust your server's Root CA before using CryptPad — on every device and browser you use.** This matters more for CryptPad than for most services, and skipping it makes CryptPad look broken rather than showing an obvious certificate warning.
>
> For `.local` addresses, IP addresses and Tor addresses, your server issues its own HTTPS certificates from its Root CA. A browser that has not been told to trust that Root CA shows a security warning.
>
> For an ordinary service you can click *"Accept the risk and continue"* and move on. **CryptPad's sandbox is loaded as an iframe from a second address, and browsers do not offer that option for content inside an iframe** — there is no "proceed anyway" button. Documents silently fail to render, or you get a certificate error naming your *sandbox* address (a different port from the one in the address bar) with no way to dismiss it.
>
> Two ways to fix it:
>
> 1. **The real fix — trust the Root CA on your device.** Download it from your server under *System → Root CA* and install it in your operating system or browser trust store. This is the only approach that keeps working: it survives restores, port changes and new browsers, and it fixes every other service on your server at the same time. If CryptPad is for anyone but yourself, do this.
> 2. **Stopgap —** grant the sandbox origin its own certificate exception. Go to the service's **Interfaces** tab, find **Sandbox Origin**, and **click one of its addresses** to open it as a normal page. Accept the warning there, then return to the Main URL; the exception now covers the iframe.
>
>    Click the address from the Interfaces tab rather than typing or pasting it. A bare `my-server.local:55491` typed into the address bar is not a URL — browsers read the part before the colon as a *scheme* and offer to hand it to an external application ("no apps available"). If you do paste it, include the `https://`.
>
>    You must repeat this whenever the sandbox address changes — notably after a restore, which assigns new ports. That is the reason option 1 is the real fix and this is only a stopgap.

## Documentation

- [CryptPad Admin Guide](https://docs.cryptpad.org/en/admin_guide/index.html) — the upstream guide for instance configuration, the `/admin/` panel, and ongoing operation.

## What you get on StartOS

- A privacy-first collaboration suite — documents, spreadsheets, presentations, whiteboards, kanban boards, code editor, forms — all encrypted in your browser before touching the server.
- The OnlyOffice editors (Document, Sheet, Presentation) are baked into the image, so first load is immediate; there is no 10–15 minute post-install download.
- All persistent data — pads, blobs, pins, blocks, the decree log, and your `loginSalt` — lives on the `main` volume and is included in StartOS backups.

## Getting set up

You will see two **Set URL** tasks the moment the install completes. Both must be done before CryptPad will start.

1. **Run the *Set Main URL* action.** Pick the URL users will open in their browser. This is the primary CryptPad address.
2. **Run the *Set Sandbox URL* action.** The sandbox must be a *different origin* from the Main URL. What that requires depends on how you are accessing CryptPad:

   - **Local access (no domain).** Nothing to arrange. StartOS gives the two interfaces different ports on the same hostname — e.g. `https://my-server.local:65223` for Main and `https://my-server.local:55041` for Sandbox. A different port is a different origin, so the browser isolates the sandbox correctly. Just pick the sandbox entry for the same hostname you used for Main.
   - **Access via a domain (including public/clearnet).** Use a **different hostname**, typically a subdomain — e.g. `cryptpad.example.com` for Main and `cryptpad-sandbox.example.com` for Sandbox. This is not about isolation, which ports already provide: upstream CryptPad warns that restrictive networks often filter traffic on unusual ports, so a production instance reached over the internet should use two real hostnames on standard ports.
3. **Wait ~30 seconds.** Once both URLs are set, CryptPad starts. A third task — *Complete CryptPad Initial Setup* — appears with the install-token URL.
4. **Run the *Complete CryptPad Initial Setup* task.** It returns a single-use URL that opens the install wizard in your browser. Create your first administrator account, customize the instance, and decide whether to leave registration open. The task auto-clears once the wizard finishes.

## Using CryptPad

### Web interface

The main URL opens straight into CryptPad — anonymous users land on the welcome page; signed-in users land in their drive.

The sandbox URL is internal iframe machinery, loaded automatically by the main interface. It is not a place you visit directly, and it does not appear as an **Open** button on the service page. It *is* still listed on the **Interfaces** tab with clickable addresses, like every interface — opening one just gives you a broken-looking page, so don't.

Day-to-day instance configuration — instance name, custom branding, registration toggle, maximum upload size, application list, support help-desk, public directory listing, 2FA requirements — lives in CryptPad's own `/admin/` panel, reachable from the user dropdown once you sign in as an administrator.

### Important: CryptPad only answers on your Main URL

StartOS can expose a service at several addresses at once — a `.local` hostname, a LAN IP, a Tor address, a domain. Most services answer on all of them. **CryptPad does not.** It serves only the origin you selected as the Main URL and refuses every other address with:

> This page can only be accessed via `https://<your-main-url>`

The page will usually stop at *Loading…* rather than redirecting you, so it can look like a hang. It isn't — you are simply at the wrong address.

> [!WARNING]
> **A login attempt from the wrong address fails as "invalid username or password".** This is the most confusing symptom of being at the wrong URL, because it looks like your account is broken. It isn't, and your password has not changed — CryptPad simply derives login keys differently when the page has not fully initialised for this instance. Go to your Main URL and log in there; the same credentials will work.

This has one practical consequence worth acting on: **the launch button on the service page may not open your Main URL.** StartOS picks from the addresses you have enabled and does not know which one CryptPad accepts. If clicking it lands you on the error above, either bookmark the Main URL and use that, or go to the service's **Interfaces** tab and disable the addresses you are not using, leaving only the one you chose. The launch button then has only the right address to offer.

Already-open tabs are unaffected until you reload them — an established session keeps working, reconnects, and saves normally.

If you change the Main URL later, expect the same thing: existing tabs keep working, but reloading any of them sends you to the new address.

### Actions

- **Set Main URL** — change the primary CryptPad URL at any time. CryptPad restarts to pick up the new value.
- **Set Sandbox URL** — change the sandbox iframe URL. Must remain a different origin from the Main URL — a different port on the same hostname counts.
- **Add Administrator by Public Key** — manage the administrator list stored in CryptPad's `config.js`. Each row accepts either a bare public signing key (from CryptPad → Settings → Account → Public Signing Key) or the full `[user@host/key=]` profile-link format. The list IS the new state — to remove an administrator, delete its row and submit.

  > **CryptPad has two separate administrator lists, and this action manages only one of them.** Expect this list to be **empty on a new install even though you already have an administrator** — that is not a bug.
  >
  > | Administrator created by | Stored in | Shown in this action? | Removable in `/admin/`? |
  > |---|---|---|---|
  > | Setup wizard, or promoted inside CryptPad | CryptPad's internal decree log | No | Yes |
  > | This action | `config.js` | Yes | No — marked *"added into config.js"*; delete the row here and submit |
  >
  > Use this action for first-admin emergency access if you missed the install-token URL, or to add and remove administrators from outside the running app.
  >
  > **Keys are checked for format, not for existence.** A key of the correct shape is accepted even if no such account exists — a typo produces an administrator entry nobody can use. Copy and paste the key rather than typing it. (CryptPad itself works the same way: because it is end-to-end encrypted, the server has no list of accounts to check against. Granting admin means "whoever holds the private half of this key", not "this registered user".)
  >
  > **If you add a key that is already an administrator** — for example the account created by the setup wizard — its **Remove** button disappears from `/admin/`, because the `config.js` entry takes precedence. Nothing is lost: delete the key from this action's list and submit, and after the restart it goes back to being removable in `/admin/`.
- **Run Diagnostics** — returns the URL of CryptPad's built-in `/checkup/` self-test. Open it in a browser to verify your install. A freshly set-up instance passes 51 of 55 tests; the four that fail are expected, not configuration errors:
  - **Encrypted support tickets not enabled** (test 14) — optional; turn on in `/admin/` → Support.
  - **No terms of service** (test 34) and **no privacy policy** (test 36) — optional instance content; add them in `/admin/` if you run an instance others register on.
  - **HSTS not required** (test 54) — StartOS handles TLS for every service at the platform edge, so this is not something CryptPad can set. It does not affect functionality or the encryption of your data.

  The checkup will also note that `/customize/application_config.js` has been customized. That is expected — StartOS uses it to store your instance's login salt.

## Restoring from a backup

Two things to expect, both normal:

**Restoring takes a long time** — tens of minutes, even for a small instance, and far longer than the backup took. The progress bar advances slowly but steadily. As long as the percentage is still climbing it has not stalled; let it finish.

**You will be asked to set both URLs again.** StartOS assigns your service new ports when it is reinstalled, so the addresses saved before the backup no longer exist. Both *Set Main URL* and *Set Sandbox URL* reappear, noting that the previous selection is no longer available. Pick the entries for the same hostname you used before — the new ports are filled in for you — and start the service.

Your data is unaffected by this: accounts, documents, uploads, administrators and instance branding all come back. Only the addresses change.

## Limitations

- **No email integration.** CryptPad has no built-in SMTP support in any current release. Account flows are end-to-end encrypted and local; the "support help-desk" feature uses CryptPad's own in-app messaging, not email. There is no SMTP action because there is nothing on the CryptPad side that would consume credentials.
