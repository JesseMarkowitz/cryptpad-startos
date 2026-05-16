import { actions } from '../actions'
import { restoreInit } from '../backups'
import { setDependencies } from '../dependencies'
import { setInterfaces } from '../interfaces'
import { sdk } from '../sdk'
import { versionGraph } from '../versions'
import { seedFiles } from './seedFiles'
import { setup } from './setup'
import { writeLoginSalt } from './writeLoginSalt'

// Order matters:
//   - seedFiles applies .catch() defaults to store.json
//   - setInterfaces / actions register before the watcher in setup so
//     setup's createOwnTask() calls can reference action definitions and
//     getMainUrls() / getSandboxUrls() can resolve interfaces
//   - writeLoginSalt runs install-only
//   - setup is the reactive task watcher (every init kind, no kind guard)
export const init = sdk.setupInit(
  restoreInit,
  versionGraph,
  seedFiles,
  setInterfaces,
  setDependencies,
  actions,
  writeLoginSalt,
  setup,
)

export const uninit = sdk.setupUninit(versionGraph)
