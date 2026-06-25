import 'dotenv/config'
import { prisma } from './lib/prisma'

async function tick() {
  console.log('[worker] tick —', new Date().toISOString())
  // Jobs implementados na Parte 2
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
