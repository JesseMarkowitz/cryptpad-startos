import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, List, Value } = sdk

/**
 * Extract the bare base64 key from either a profile-link
 * (`[name@host:port/keyValue=]`) or a bare key.
 *
 * Character class accepts BOTH standard base64 (`+/`) and base64url (`-_`).
 * The prior attempt's narrower `[A-Za-z0-9+/]+=*` silently rejected
 * base64url-encoded keys; CryptPad keys observed in the wild use both.
 */
function extractKey(raw: string): string {
  const trimmed = raw.trim()
  // Profile-link form: anything-but-`]`, then `/`, then the key, then `]`.
  const m = trimmed.match(/^\[[^\]]*?\/([A-Za-z0-9+/_\-]+=*)\]$/)
  if (m) return m[1]
  // Bare-key form.
  if (/^[A-Za-z0-9+/_\-]+=*$/.test(trimmed)) return trimmed
  throw new Error(`Invalid admin key: ${raw}`)
}

const inputSpec = InputSpec.of({
  adminKeys: Value.list(
    List.text(
      {
        name: i18n('Administrator Public Keys'),
        description: i18n(
          'Each row is one administrator. Accepts either a bare public signing key (e.g. CU6kIC-J4zPUqkXuWcxCApSvT4JkhpfBNbf13Mz+Vg4=) OR the full profile-link format ([username@instance.example.com/CU6k...]). To remove an admin, delete its row and submit — the list is the new state, not a delta.',
        ),
        default: [],
      },
      {
        patterns: [],
        placeholder: 'base64Key  or  [user@host/base64Key]',
      },
    ),
  ),
})

/**
 * This action is for first-admin emergency access (when the install token
 * URL was missed) and bulk add/remove from outside the running app. The
 * day-to-day path for managing admins is CryptPad's in-app /admin/#support
 * panel — see README.
 */
export const addAdminKey = sdk.Action.withInput(
  'add-admin-key',

  async ({ effects }) => ({
    name: i18n('Add Administrator by Public Key'),
    description: i18n(
      "Add or remove CryptPad administrators by their public signing key. Submit an empty list to revoke all admin keys configured here (CryptPad's in-app /admin/ panel is unaffected — admins added through the install wizard or the in-app panel persist independently).",
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  // Pre-fill with the current saved keys so removal is obvious: edit the
  // list, delete a row, submit — the saved list IS the new state.
  async ({ effects }) => ({
    adminKeys: (await storeJson.read((s) => s.adminKeys).once()) ?? [],
  }),

  async ({ effects, input }) => {
    const cleaned = Array.from(
      new Set(input.adminKeys.map((raw: string) => extractKey(raw))),
    )
    await storeJson.merge(effects, { adminKeys: cleaned })
  },
)
