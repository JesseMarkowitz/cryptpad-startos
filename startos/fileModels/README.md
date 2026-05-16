## fileModels

This package's only file model is `store.json.ts` — a small zod schema for
StartOS-managed state: admin keys mirrored into `config.js`, the user-chosen
main and sandbox URLs, and a one-shot latch for the wizard-completion
notification.

CryptPad's actual `config.js` is **not** a file model. It is regenerated
from scratch on every restart from `store.json` plus upstream defaults; the
generator lives in `../cryptpadConfig.ts`.

Everything else CryptPad reads (`/admin/`-panel state, decree log, pad data)
is written by CryptPad itself and lives on the `main` volume — no file model
exists for any of it.
