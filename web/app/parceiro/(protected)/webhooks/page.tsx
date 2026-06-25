import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export default async function WebhooksPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const logs = await prisma.webhookLog.findMany({
    where: { parceiroId: sessao.parceiroId },
    orderBy: { criadoEm: 'desc' },
    take: 100,
  })

  async function reenviar(logId: string) {
    'use server'
    const sessaoAtual = await getSessaoParceiro()
    if (!sessaoAtual) return

    await prisma.webhookLog.update({
      where: { id: logId, parceiroId: sessaoAtual.parceiroId },
      data: { tentativas: 0, tentadoEm: null },
    })

    revalidatePath('/parceiro/webhooks')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Webhooks</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Evento</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">URL</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Tentativas</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-gray-50 last:border-0">
                <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{log.criadoEm.toLocaleString('pt-BR')}</td>
                <td className="px-6 py-3">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{log.evento}</span>
                </td>
                <td className="px-6 py-3 text-gray-500 text-xs truncate max-w-[200px]">{log.url}</td>
                <td className="px-6 py-3 text-right text-gray-700">{log.tentativas}</td>
                <td className="px-6 py-3">
                  {log.sucesso
                    ? <span className="text-green-600 font-medium">✓ Sucesso</span>
                    : <span className="text-red-500">✗ Falhou</span>
                  }
                </td>
                <td className="px-6 py-3">
                  {!log.sucesso && log.tentativas < 4 && (
                    <form action={reenviar.bind(null, log.id)}>
                      <button type="submit" className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        Reenviar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum webhook disparado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
