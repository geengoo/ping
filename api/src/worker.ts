import 'dotenv/config'
import { confirmarConversoes } from './jobs/confirmarConversoes'
import { dispararWebhooks } from './jobs/dispararWebhooks'
import { alertarSaques } from './jobs/alertarSaques'

async function tick() {
  console.log('[worker] tick —', new Date().toISOString())
  try {
    await confirmarConversoes()
  } catch (err) {
    console.error('[worker] confirmarConversoes erro:', err)
  }
  try {
    await dispararWebhooks()
  } catch (err) {
    console.error('[worker] dispararWebhooks erro:', err)
  }
  try {
    await alertarSaques()
  } catch (err) {
    console.error('[worker] alertarSaques erro:', err)
  }
}

async function main() {
  console.log('[worker] iniciando')
  await tick()
  setInterval(tick, 60 * 60 * 1000)
}

main().catch((err) => {
  console.error('[worker] erro fatal:', err)
  process.exit(1)
})
