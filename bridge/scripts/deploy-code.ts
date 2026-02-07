/** Quick helper to deploy sprite/src/ to a Sprite. */
import { configureSpritesClient } from '../src/sprites-client.js'
import { deployCode } from '../src/bootstrap.js'

const TOKEN = process.env.SPRITES_TOKEN || ''
const SPRITE = process.argv[2] || 'sd-e2e-test'

configureSpritesClient({ token: TOKEN })
await deployCode(SPRITE)
console.log('Done')
