import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

// Empty merge applies all .catch() defaults (per init.md "Empty-Seed Inits:
// Drop the kind parameter"). Runs every init kind — idempotent, no harm in
// running on container rebuild as well as install/restore/update.
export const seedFiles = sdk.setupOnInit(async (effects) => {
  await storeJson.merge(effects, {})
})
