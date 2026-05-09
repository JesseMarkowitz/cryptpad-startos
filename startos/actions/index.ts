import { sdk } from '../sdk'
import { addAdminKey } from './addAdminKey'
import { setMainUrl } from './setMainUrl'
import { setSandboxUrl } from './setSandboxUrl'
import { showSetupTokenUrl } from './showSetupTokenUrl'

export const actions = sdk.Actions.of()
  .addAction(setMainUrl)
  .addAction(setSandboxUrl)
  .addAction(showSetupTokenUrl)
  .addAction(addAdminKey)
