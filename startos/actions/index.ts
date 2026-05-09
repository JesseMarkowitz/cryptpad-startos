import { sdk } from '../sdk'
import { setMainUrl } from './setMainUrl'

export const actions = sdk.Actions.of().addAction(setMainUrl)
