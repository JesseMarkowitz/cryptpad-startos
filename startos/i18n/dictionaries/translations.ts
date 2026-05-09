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
    6: 'Origen del sandbox',
    7: 'Origen del iframe interno para el sandbox de documentos de CryptPad. Cargado automáticamente por la UI principal; no es un destino para el usuario. Se requiere por separado para que el navegador vea un origen diferente y pueda aplicar el aislamiento del sandbox mediante la política del mismo origen.',
  },
  de_DE: {
    0: 'CryptPad wird gestartet',
    1: 'Weboberfläche',
    2: 'CryptPad ist bereit',
    3: 'CryptPad ist nicht bereit',
    4: 'Weboberfläche',
    5: 'Der kollaborative CryptPad-Editor',
    6: 'Sandbox-Origin',
    7: 'Interner iframe-Origin für die CryptPad-Dokumenten-Sandbox. Wird automatisch von der Haupt-UI geladen; kein Benutzer-Ziel. Wird separat benötigt, damit der Browser einen anderen Origin sieht und die Sandbox-Isolation über die Same-Origin-Policy durchsetzen kann.',
  },
  pl_PL: {
    0: 'Uruchamianie CryptPad',
    1: 'Interfejs webowy',
    2: 'CryptPad jest gotowy',
    3: 'CryptPad nie jest gotowy',
    4: 'Interfejs webowy',
    5: 'Edytor współpracy CryptPad',
    6: 'Pochodzenie sandboxa',
    7: 'Wewnętrzne pochodzenie iframe dla sandboxa dokumentów CryptPad. Ładowane automatycznie przez główne UI; nie jest celem użytkownika. Wymagane oddzielnie, aby przeglądarka widziała inne pochodzenie i mogła egzekwować izolację sandboxa za pomocą polityki tego samego pochodzenia.',
  },
  fr_FR: {
    0: 'Démarrage de CryptPad',
    1: 'Interface web',
    2: 'CryptPad est prêt',
    3: "CryptPad n'est pas prêt",
    4: 'Interface web',
    5: "L'éditeur collaboratif CryptPad",
    6: 'Origine du bac à sable',
    7: "Origine d'iframe interne pour le bac à sable de documents de CryptPad. Chargée automatiquement par l'interface principale ; ce n'est pas une destination pour l'utilisateur. Requise séparément pour que le navigateur voie une origine différente et puisse appliquer l'isolation du bac à sable via la politique de même origine.",
  },
} satisfies Record<string, LangDict>
