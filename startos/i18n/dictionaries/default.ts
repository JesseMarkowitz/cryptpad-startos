export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting CryptPad': 0,
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
  'Choose which URL CryptPad should use as its sandbox iframe origin. This must be a different hostname from the Main URL — the browser uses the origin difference to enforce sandbox isolation around document rendering.': 12,

  // actions/showSetupTokenUrl.ts
  'Show Setup Token URL': 13,
  'Open this URL in a browser to create your CryptPad administrator account. The URL is single-use — once you complete the wizard, it is no longer valid.': 14,
  "The CryptPad daemon hasn't bootstrapped yet. Wait ~30 seconds and retry.": 15,
  'Setup is already complete — your administrator account exists. Use the /admin/ panel for further configuration.': 16,
  'CryptPad Setup URL': 17,
  'Open this URL in a browser to create your administrator account.': 18,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
