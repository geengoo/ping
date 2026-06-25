import { prisma } from '../lib/prisma'
import type { WebhookLog } from '@prisma/client'

const BACKOFF_MS = [0, 60 * 60 * 1000, 4 * 60 * 60 * 1000, 24 * 60 * 60 * 1000]

function backoffExpirou(log: WebhookLog): boolean {
  if (log.tentativas === 0) return true
  if (!log.tentadoEm) return true
  const delay = BACKOFF_MS[log.tentativas] ?? BACKOFF_MS[BACKOFF_MS.length - 1]
  return Date.now() >= log.tentadoEm.getTime() + delay
}

export async function dispararWebhooks() {
  const logs = await prisma.webhookLog.findMany({
    where: { sucesso: false, tentativas: { lt: 4 } },
  })

  let disparados = 0

  for (const log of logs) {
    if (!backoffExpirou(log)) continue
    if (!log.url) continue

    const agora = new Date()

    try {
      const res = await fetch(log.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log.payload),
        signal: AbortSignal.timeout(10_000),
      })

      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          statusCode: res.status,
          sucesso: res.ok,
          tentativas: log.tentativas + 1,
          tentadoEm: agora,
          erro: res.ok ? null : `HTTP ${res.status}`,
        },
      })

      if (res.ok) disparados++
    } catch (err) {
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          tentativas: log.tentativas + 1,
          tentadoEm: agora,
          erro: err instanceof Error ? err.message : String(err),
        },
      })
    }
  }

  console.log(`[dispararWebhooks] ${disparados} webhook(s) disparado(s)`)
}
