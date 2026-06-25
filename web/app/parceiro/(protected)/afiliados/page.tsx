import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AfiliadosPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const participacoes = await prisma.participacao.findMany({
    where: { campanha: { parceiroId: sessao.parceiroId } },
    orderBy: { entrouEm: 'desc' },
    include: {
      afiliado: { select: { nome: true, email: true } },
      rewards: { select: { status: true, valorCentavos: true } },
      conversoes: { select: { id: true } },
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Afiliados</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Nome</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Email</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Conversões</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Saldo disponível</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Entrou em</th>
            </tr>
          </thead>
          <tbody>
            {participacoes.map(p => {
              const saldoDisponivel = p.rewards
                .filter(r => r.status === 'disponivel')
                .reduce((s, r) => s + r.valorCentavos, 0)
              return (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-6 py-3 text-gray-700">{p.afiliado.nome}</td>
                  <td className="px-6 py-3 text-gray-500">{p.afiliado.email}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{p.conversoes.length}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{fmt(saldoDisponivel)}</td>
                  <td className="px-6 py-3 text-gray-500">{p.entrouEm.toLocaleDateString('pt-BR')}</td>
                </tr>
              )
            })}
            {participacoes.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum afiliado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
