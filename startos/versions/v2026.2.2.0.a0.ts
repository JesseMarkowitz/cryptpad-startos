import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_2026_2_2_0_a0 = VersionInfo.of({
  version: '2026.2.2:0-alpha.0',
  releaseNotes: {
    en_US:
      'Initial v1 implementation. Two-MultiHost design with a sandbox interface (type api) for browser-side origin isolation. ' +
      'OnlyOffice baked into the image at build time (no first-run download). ' +
      'loginSalt persisted to volume so user passwords survive backup-restore. ' +
      'Single /api/config health check. Onboarding via three critical tasks: Set Main URL, Set Sandbox URL, then Complete CryptPad Initial Setup.',
    es_ES:
      'Implementación inicial v1. Diseño de dos MultiHost con una interfaz sandbox (tipo api) para aislamiento de origen del navegador. ' +
      'OnlyOffice incluido en la imagen en tiempo de compilación (sin descarga en el primer arranque). ' +
      'loginSalt persistido en el volumen para que las contraseñas sobrevivan a la restauración. ' +
      'Verificación de estado única en /api/config. Incorporación mediante tres tareas críticas: Establecer URL principal, Establecer URL del sandbox y Completar la configuración inicial de CryptPad.',
    de_DE:
      'Erste v1-Implementierung. Zwei-MultiHost-Design mit einer Sandbox-Schnittstelle (Typ api) für browserseitige Ursprungs-Isolation. ' +
      'OnlyOffice zur Build-Zeit in das Image integriert (kein Download beim ersten Start). ' +
      'loginSalt wird auf dem Volume persistiert, sodass Passwörter eine Wiederherstellung überleben. ' +
      'Einziger /api/config-Health-Check. Onboarding über drei kritische Aufgaben: Haupt-URL festlegen, Sandbox-URL festlegen, dann CryptPad-Initialeinrichtung abschließen.',
    pl_PL:
      'Wstępna implementacja v1. Konstrukcja z dwoma MultiHost i interfejsem sandbox (typ api) dla izolacji pochodzenia po stronie przeglądarki. ' +
      'OnlyOffice wbudowany w obraz na etapie budowy (brak pobierania przy pierwszym uruchomieniu). ' +
      'loginSalt zapisany na woluminie, dzięki czemu hasła użytkowników przeżywają przywracanie z kopii zapasowej. ' +
      'Pojedyncze sprawdzenie stanu /api/config. Onboarding przez trzy krytyczne zadania: Ustaw główny URL, Ustaw URL sandboxa, a następnie Zakończ wstępną konfigurację CryptPad.',
    fr_FR:
      'Implémentation initiale v1. Conception à deux MultiHost avec une interface bac à sable (type api) pour l\'isolation d\'origine côté navigateur. ' +
      'OnlyOffice intégré à l\'image au moment de la construction (pas de téléchargement au premier démarrage). ' +
      'loginSalt persisté sur le volume pour que les mots de passe survivent à la restauration. ' +
      'Vérification d\'état unique sur /api/config. Onboarding via trois tâches critiques : Définir l\'URL principale, Définir l\'URL du bac à sable, puis Compléter la configuration initiale de CryptPad.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
