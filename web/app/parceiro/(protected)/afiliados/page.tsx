import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABEL: Record<string, string> = {
  pendente:   'Pendente',
  confirmada: 'Confirmada',
  cancelada:  'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  pendente:   'bg-yellow-50 text-yellow-700',
  confirmada: 'bg-green-50 text-green-700',
  cancelada:  'bg-red-50 text-red-600',
}

export default async function AfiliadosPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const conversoes = await prisma.conversao.findMany({
    where: { participacao: { campanha: { parceiroId: sessao.parceiroId } } },
    orderBy: { criadoEm: 'desc' },
    include: { reward: { select: { valorCentavos: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-gray-900">Indicações</h1>
        <span className="text-sm text-gray-400">{conversoes.length} no total</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium whitespace-nowrap">Data</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Produto</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium whitespace-nowrap">Valor</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium whitespace-nowrap">Comissão</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {conversoes.map(c => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {c.criadoEm.toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[130px] truncate">
                    {c.nomeConvidado || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                    {c.emailConvidado}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                    {c.produtoNome}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                    {fmt(c.valorCentavos)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                    {c.reward ? fmt(c.reward.valorCentavos) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </td>
                </tr>
              ))}
              {conversoes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400 text-sm">
                    Nenhuma indicação ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
