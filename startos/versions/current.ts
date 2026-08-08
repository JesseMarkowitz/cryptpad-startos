import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '2026.5.1:0',
  releaseNotes: {
    en_US:
      'Initial release of CryptPad for StartOS, wrapping upstream 2026.5.1. ' +
      'CryptPad is served on two separate URLs — a main URL and a sandbox URL — which the browser uses to isolate document rendering. ' +
      'Set both from the Actions tab, then complete the one-time setup to create your administrator account. ' +
      'The Document, Sheet, and Presentation editors (OnlyOffice) are built into the package, so there is no download on first start.',
    es_ES:
      'Versión inicial de CryptPad para StartOS, basada en la versión 2026.5.1. ' +
      'CryptPad se sirve en dos URL distintas — una principal y otra de sandbox — que el navegador utiliza para aislar la representación de documentos. ' +
      'Configura ambas desde la pestaña Acciones y luego completa la configuración inicial para crear tu cuenta de administrador. ' +
      'Los editores de Documento, Hoja de cálculo y Presentación (OnlyOffice) vienen incluidos en el paquete, por lo que no hay descarga al primer inicio.',
    de_DE:
      'Erstveröffentlichung von CryptPad für StartOS auf Basis von Upstream 2026.5.1. ' +
      'CryptPad wird über zwei getrennte URLs bereitgestellt — eine Haupt-URL und eine Sandbox-URL —, mit denen der Browser die Dokumentdarstellung isoliert. ' +
      'Lege beide im Tab Aktionen fest und schließe anschließend die einmalige Einrichtung ab, um dein Administratorkonto zu erstellen. ' +
      'Die Editoren für Dokumente, Tabellen und Präsentationen (OnlyOffice) sind im Paket enthalten, es gibt also keinen Download beim ersten Start.',
    pl_PL:
      'Pierwsze wydanie CryptPad dla StartOS, oparte na wersji 2026.5.1. ' +
      'CryptPad jest udostępniany pod dwoma osobnymi adresami URL — głównym i sandboxa — których przeglądarka używa do izolowania renderowania dokumentów. ' +
      'Ustaw oba w zakładce Akcje, a następnie zakończ jednorazową konfigurację, aby utworzyć konto administratora. ' +
      'Edytory dokumentów, arkuszy i prezentacji (OnlyOffice) są wbudowane w pakiet, więc przy pierwszym uruchomieniu nic nie jest pobierane.',
    fr_FR:
      'Version initiale de CryptPad pour StartOS, basée sur la version 2026.5.1. ' +
      'CryptPad est servi sur deux URL distinctes — une URL principale et une URL de bac à sable — que le navigateur utilise pour isoler le rendu des documents. ' +
      "Définissez les deux depuis l'onglet Actions, puis terminez la configuration initiale pour créer votre compte administrateur. " +
      'Les éditeurs de documents, tableurs et présentations (OnlyOffice) sont intégrés au paquet : aucun téléchargement au premier démarrage.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
