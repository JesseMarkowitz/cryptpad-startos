import { setupManifest } from '@start9labs/start-sdk'
import { alertInstall, long, short } from './i18n'

export const manifest = setupManifest({
  id: 'cryptpad',
  title: 'CryptPad',
  license: 'AGPL-3.0',
  packageRepo: 'https://github.com/JesseMarkowitz/cryptpad-startos',
  upstreamRepo: 'https://github.com/cryptpad/cryptpad',
  marketingUrl: 'https://cryptpad.org/',
  donationUrl: 'https://opencollective.com/cryptpad',
  docsUrls: ['https://docs.cryptpad.org/en/admin_guide/index.html'],
  description: { short, long },
  volumes: ['main'],
  images: {
    cryptpad: {
      // dockerBuild references the Dockerfile in the repo root.
      // The build-pipeline commit adds the OnlyOffice install layer; this
      // commit ships a placeholder Dockerfile that just inherits from the
      // upstream image so the package builds end-to-end.
      source: { dockerBuild: {} },
      arch: ['x86_64', 'aarch64'],
    },
  },
  alerts: {
    install: alertInstall,
    update: null,
    uninstall: null,
    restore: null,
    start: null,
    stop: null,
  },
  dependencies: {},
})
