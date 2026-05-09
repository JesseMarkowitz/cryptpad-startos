import { LangDict } from './default'

/**
 * Translations are populated incrementally as components are added (see PLAN
 * §14: i18n strings translated into all five locales BEFORE sideload-test).
 * Empty dictionaries are valid here — the SDK falls back to DEFAULT_LANG for
 * any missing key.
 */
export default {
  es_ES: {
    0: 'Iniciando CryptPad',
    1: 'Interfaz web',
    2: 'CryptPad está listo',
    3: 'CryptPad no está listo',
    4: 'Interfaz web',
    5: 'El editor colaborativo CryptPad',
  },
  de_DE: {
    0: 'CryptPad wird gestartet',
    1: 'Weboberfläche',
    2: 'CryptPad ist bereit',
    3: 'CryptPad ist nicht bereit',
    4: 'Weboberfläche',
    5: 'Der kollaborative CryptPad-Editor',
  },
  pl_PL: {
    0: 'Uruchamianie CryptPad',
    1: 'Interfejs webowy',
    2: 'CryptPad jest gotowy',
    3: 'CryptPad nie jest gotowy',
    4: 'Interfejs webowy',
    5: 'Edytor współpracy CryptPad',
  },
  fr_FR: {
    0: 'Démarrage de CryptPad',
    1: 'Interface web',
    2: 'CryptPad est prêt',
    3: "CryptPad n'est pas prêt",
    4: 'Interface web',
    5: "L'éditeur collaboratif CryptPad",
  },
} satisfies Record<string, LangDict>
