export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Web Interface': 1,
  'CryptPad is ready': 2,
  'CryptPad is not ready': 3,

  // interfaces.ts
  'Web UI': 4,
  'The CryptPad collaborative editor': 5,
  'Sandbox Origin': 6,
  "Internal iframe origin for CryptPad's document sandbox. Loaded automatically by the main UI; not a user destination. Required separately so the browser sees a different origin and can enforce sandbox isolation via the same-origin policy.": 7,

  // actions/setMainUrl.ts
  URL: 8,
  'Set Main URL': 9,
  'Choose which URL CryptPad should serve as its main app. This is the URL users open in their browser. CryptPad will not start until both Main URL and Sandbox URL are set.': 10,

  // actions/setSandboxUrl.ts
  'Set Sandbox URL': 11,
  'Choose which URL CryptPad should use as its sandbox iframe origin. It must be a different ORIGIN from the Main URL. A different port on the same hostname is enough — StartOS assigns the two interfaces different ports automatically — or use a different hostname if you are serving CryptPad over a domain. The browser relies on that difference to isolate document rendering.': 12,

  // actions/showSetupTokenUrl.ts
  'Complete CryptPad Initial Setup': 13,
  'Open this URL in a browser to create your CryptPad administrator account. The URL is single-use — once you complete the wizard, it is no longer valid.': 14,
  "The CryptPad daemon hasn't bootstrapped yet. Wait ~30 seconds and retry.": 15,
  'Setup is already complete — your administrator account exists. Use the /admin/ panel for further configuration.': 16,
  'CryptPad Setup URL': 17,
  'Open this URL in a browser to create your administrator account.': 18,

  // actions/addAdminKey.ts
  'Administrator Public Keys': 19,
  "Each row is one administrator's public signing key, found in CryptPad under Settings → Account. Accepts either a bare key (e.g. CU6kIC-J4zPUqkXuWcxCApSvT4JkhpfBNbf13Mz+Vg4=) OR the full profile-link format ([username@instance.example.com/CU6k...]). This list is the complete new state, not a delta — to remove an administrator, delete its row and submit. Starts empty on a new install even if you already have an administrator: the setup-wizard admin is not stored here.": 20,
  'Add Administrator by Public Key': 21,
  'CryptPad keeps TWO separate administrator lists, and this action manages only one of them: the keys written into config.js. Administrators created by the setup wizard, or promoted from inside CryptPad, live in a different list — they will NOT appear here, and this action cannot remove them (use CryptPad\'s own /admin/ panel for those). In the reverse direction, keys added here show up in /admin/ marked "added into config.js" with no Remove button, because re-running this action with the row deleted is the only way to revoke them. So an empty list here is normal on a new install, even when you already have a working administrator.': 22,

  // actions/runDiagnostics.ts
  'Run Diagnostics': 23,
  "Open the URL returned by this action in a browser to run CryptPad's built-in self-diagnostic tests. Use this to verify your install or troubleshoot. NOTE: four tests fail by design on a fresh instance and are not configuration errors — encrypted support tickets, terms of service, and privacy policy are optional settings you enable in /admin/, and HSTS is handled by StartOS at the TLS edge so CryptPad cannot set it. See the Instructions tab for details.": 24,
  'CryptPad Diagnostics': 25,
  "Open this URL in a browser to run CryptPad's diagnostic checkup.": 26,

  // init/setup.ts (reactive watcher tasks)
  'Choose the primary domain for the CryptPad UI.': 27,
  'Your previously selected Main URL is no longer available. Pick a new one.': 28,
  "Choose the sandbox domain for CryptPad's document iframe isolation.": 29,
  'Your previously selected Sandbox URL is no longer available. Pick a new one.': 30,
  'Open this URL once and complete the wizard to create your CryptPad administrator account.': 31,

  // init/setup.ts (wizard-completion notification)
  'CryptPad setup complete': 32,
  'Your administrator account is active. Open the /admin/ panel inside CryptPad for further configuration.': 33,

  // main.ts (startup gates) and setter actions (cross-origin gate)
  'CryptPad cannot start until both Main URL and Sandbox URL are set. Run the Set Main URL and Set Sandbox URL actions, then start the service.': 34,
  'CryptPad cannot start: Main URL and Sandbox URL must be different origins, but both resolve to': 35,
  'The browser uses the origin difference to enforce sandbox isolation around document rendering — same-origin would disable that protection. Re-run Set Main URL or Set Sandbox URL and pick an entry that differs in hostname or port.': 36,

  // actions/runDiagnostics.ts and actions/showSetupTokenUrl.ts (defensive throws)
  'Main URL is not set; cannot construct diagnostics URL. Run the Set Main URL action and try again.': 37,
  'Main URL is not set; cannot construct setup URL. Run the Set Main URL action and try again.': 38,

  // actions/addAdminKey.ts (parser failure)
  'Invalid admin key:': 39,

  // actions/setMainUrl.ts and actions/setSandboxUrl.ts (cross-origin gate)
  'Main URL and Sandbox URL must be different origins so the browser can enforce sandbox isolation. Two addresses differ if either the hostname or the port differs. Pick a different one.': 40,
  // actions/addAdminKey.ts (submit acknowledgement)
  'Administrator List Updated': 41,
  'All config.js administrator keys have been revoked. CryptPad is restarting to apply the change. Administrators created by the setup wizard or from inside the app are unaffected.': 42,
  'CryptPad is restarting to apply the change. These keys will appear in the /admin/ panel marked "added into config.js"; to revoke one, re-run this action with its row deleted.': 43,
  '(none)': 44,
  // actions/addAdminKey.ts (validation + result rows)
  Administrator: 45,
  'a CryptPad public signing key is exactly 44 characters ending in "=". Copy it from CryptPad under Settings → Account, or paste the whole profile link in the form [username@instance/key=].': 46,
  // actions/addAdminKey.ts (inline input pattern)
  'Must be a 44-character key ending in "=", or a full [username@instance/key=] profile link.': 47,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
