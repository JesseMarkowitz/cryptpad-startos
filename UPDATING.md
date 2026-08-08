# Updating the upstream version

Upstream is the official **`cryptpad/cryptpad`** Docker image, pinned by tag.

The pin lives in **`Dockerfile`**, not in `startos/manifest/index.ts` — the manifest declares
`source: { dockerBuild: {} }` because this package builds a thin layer on top of upstream (it
bakes OnlyOffice in at build time). Nothing in `startos/` names an image tag.

## Determining the upstream version

```bash
gh release view -R cryptpad/cryptpad --json tagName -q .tagName
```

Two tag-format quirks:

- Upstream git tags carry **no `v` prefix** — the tag is `2026.5.1`, and
  `https://github.com/cryptpad/cryptpad/blob/v2026.5.1/...` is a 404.
- The Docker tag **does** carry a `version-` prefix — release `2026.5.1` publishes as
  `cryptpad/cryptpad:version-2026.5.1`.

Confirm the tag publishes both architectures the manifest declares (`x86_64`, `aarch64`):

```bash
curl -s https://hub.docker.com/v2/repositories/cryptpad/cryptpad/tags/version-<X.Y.Z> \
  | python3 -c "import sys,json;[print(i['architecture']) for i in json.load(sys.stdin)['images']]"
```

## Applying the bump

1. `Dockerfile` — edit the `FROM cryptpad/cryptpad:version-X.Y.Z` line.
2. `startos/versions/current.ts` — set `version` to `'<X.Y.Z>:0'` and rewrite `releaseNotes`
   for all five locales. Bump the downstream revision (`:0` → `:1`) instead when the change is
   wrapper-only with no upstream move. Do **not** add a downstream prerelease suffix — see
   `versions.md`. Only spin off a historical version file if the bump needs a migration.
3. **Re-verify the pinned upstream claims.** This is the part that silently rots. Several files
   cite upstream source at a specific tag (`@2026.5.1`) and encode assumptions about it. Check
   each against the new tag and update the marker:

   | What to check | Upstream file | Why it matters |
   |---|---|---|
   | `[ ! -f "$CPAD_CONF" ]` guard; required env vars | `docker-entrypoint.sh` | Our pre-written `config.js` depends on this guard to bypass the entrypoint's auto-generation branch |
   | `ADD_INSTALL_TOKEN` decree shape; the zero-admins gate; the `/install/#<token>` URL | `lib/api.js` | `startos/decrees.ts` parses the log by hand |
   | `ADD_ADMIN_KEY` is what lands in the log | `lib/decrees.js`, `lib/commands/admin-rpc.js` | The wizard sends `['ADD_FIRST_ADMIN', ['ADD_ADMIN_KEY', [key]]]`, but `adminDecree` reads `data[1]`, so the log line is `["ADD_ADMIN_KEY", [key], "", ts]`. That's the completion signal `decrees.ts` keys on — if the envelope handling ever changes, the setup task stops clearing |
   | `/cryptpad_websocket` upgrade proxy → `websocketPort` | `lib/http-worker.js` | Justifies never binding 3003 externally |
   | `setHeaders` CSP/COEP/CORP behavior | `lib/http-worker.js` | Justifies the "no in-container reverse proxy" rule in `Dockerfile` |
   | `--accept-license` / `--trust-repository`; `dist/` vs `onlyoffice-conf/` split | `install-onlyoffice.sh` | The OnlyOffice bake and the `onlyoffice-conf` volume mount |
   | UID/GID still 4001 | `Dockerfile` | Every `chown` in `startos/main.ts` and `startos/init/writeLoginSalt.ts` |
   | The IIFE module-factory wrapper | `customize.dist/application_config.js` | `writeLoginSalt.ts` reproduces this shape verbatim; a mismatch throws in the browser and hangs the SPA |
   | Port defaults, `installMethod`, `httpAddress`, and every path key | `config/config.example.js` | `startos/upstream-defaults.ts` and `startos/cryptpadConfig.ts` |

4. Update the `@<version>` markers in comments across `Dockerfile`, `startos/upstream-defaults.ts`,
   `startos/cryptpadConfig.ts`, `startos/setupState.ts`, `startos/main.ts`, `startos/interfaces.ts`.
5. Run `npm test`. The decree-log parser has regression tests (`test/setupState.test.ts`)
   covering the shapes upstream actually emits. They will not catch a *new* decree verb, but they
   will catch a change to the shapes already relied on — cheap, and worth running before the
   manual pass.
6. Rebuild, then re-run `NextSteps.md` — at minimum the OnlyOffice and backup/restore items.
