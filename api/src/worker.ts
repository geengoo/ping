import 'dotenv/config'
import { prisma } from './lib/prisma'
import { confirmarConversoes } from './jobs/confirmarConversoes'
import { dispararWebhooks } from './jobs/dispararWebhooks'
import { alertarSaques } from './jobs/alertarSaques'

async function tick() {
  console.log('[worker] tick —', new Date().toISOString())

  let t = Date.now()
  console.log('[worker] confirmarConversoes iniciando')
  try {
    await confirmarConversoes()
  } catch (err) {
    console.error('[worker] erro confirmarConversoes:', err)
  }
  console.log(`[worker] confirmarConversoes concluído em ${Date.now() - t}ms`)

  t = Date.now()
  console.log('[worker] dispararWebhooks iniciando')
  try {
    await dispararWebhooks()
  } catch (err) {
    console.error('[worker] erro dispararWebhooks:', err)
  }
  console.log(`[worker] dispararWebhooks concluído em ${Date.now() - t}ms`)

  t = Date.now()
  console.log('[worker] alertarSaques iniciando')
  try {
    await alertarSaques()
  } catch (err) {
    console.error('[worker] erro alertarSaques:', err)
  }
  console.log(`[worker] alertarSaques concluído em ${Date.now() - t}ms`)
}

async function main() {
  console.log('[worker] iniciando')
  await tick()
  setInterval(tick, 60 * 60 * 1000)
  // O setInterval mantém o processo vivo, então finally executa apenas no encerramento.
  // A abordagem correta é handler de SIGTERM (que o PM2 usa para parar gracefully).
  process.on('SIGTERM', async () => {
    console.log('[worker] recebido SIGTERM, desconectando...')
    await prisma.$disconnect()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[worker] erro fatal:', err)
  process.exit(1)
})
