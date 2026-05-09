import { sdk } from '../sdk'
import { setMainUrl } from './setMainUrl'
import { setSandboxUrl } from './setSandboxUrl'

export const actions = sdk.Actions.of()
  .addAction(setMainUrl)
  .addAction(setSandboxUrl)
