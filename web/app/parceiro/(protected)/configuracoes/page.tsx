import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CopyButton } from '@/components/parceiro/CopyButton'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function ConfiguracoesPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const parceiro = await prisma.parceiro.findUnique({
    where: { id: sessao.parceiroId },
    include: { campanhas: { where: { status: 'ativa' }, take: 1 } },
  })

  if (!parceiro) redirect('/parceiro/login')

  const campanha = parceiro.campanhas[0]

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-display font-bold text-gray-900">Configurações</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Integração</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1">API Key</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 truncate">
                {parceiro.apiKey}
              </code>
              <CopyButton valor={parceiro.apiKey} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1">Webhook URL</label>
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              {parceiro.webhookUrl || <span className="text-gray-400">Não configurado</span>}
            </p>
          </div>
        </div>
      </div>

      {campanha && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Campanha ativa — {campanha.nome}</h2>
          </div>
          <dl className="divide-y divide-gray-100">
            {[
              ['Status', campanha.status],
              ['Janela de cancelamento', `${campanha.janelaCancelamentoDias} dias`],
              ['Tipo de recompensa', campanha.recompensaTipo],
              ['Valor da recompensa', fmt(campanha.recompensaValorCentavos)],
              ['Dia de pagamento', `Dia ${campanha.diaPagamento}`],
              ['Atribuição', campanha.atribuicao],
            ].map(([k, v]) => (
              <div key={k} className="px-6 py-3 flex gap-4">
                <dt className="text-xs text-gray-400 w-44 shrink-0 pt-0.5">{k}</dt>
                <dd className="text-sm text-gray-700">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
