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
  description: { short, long },
  volumes: ['main'],
  images: {
    cryptpad: {
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
