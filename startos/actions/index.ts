import { sdk } from '../sdk'
import { setMainUrl } from './setMainUrl'
import { setSandboxUrl } from './setSandboxUrl'
import { showSetupTokenUrl } from './showSetupTokenUrl'

export const actions = sdk.Actions.of()
  .addAction(setMainUrl)
  .addAction(setSandboxUrl)
  .addAction(showSetupTokenUrl)
