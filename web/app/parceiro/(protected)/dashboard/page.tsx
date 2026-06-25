import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function formatarValor(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diasDesde(data: Date) {
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function DashboardPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)

  const [conversoesMes, saquesSolicitados, ultimasConversoes] = await Promise.all([
    prisma.conversao.count({
      where: {
        participacao: { campanha: { parceiroId: sessao.parceiroId } },
        criadoEm: { gte: inicioMes },
      },
    }),
    prisma.reward.findMany({
      where: {
        participacao: { campanha: { parceiroId: sessao.parceiroId } },
        status: 'solicitado',
      },
      select: { id: true, valorCentavos: true, solicitadoEm: true },
    }),
    prisma.conversao.findMany({
      where: { participacao: { campanha: { parceiroId: sessao.parceiroId } } },
      orderBy: { criadoEm: 'desc' },
      take: 10,
      include: {
        participacao: { include: { afiliado: { select: { nome: true } } } },
      },
    }),
  ])

  const afiliadosAtivos = await prisma.participacao.count({
    where: {
      campanha: { parceiroId: sessao.parceiroId },
      conversoes: { some: {} },
    },
  })

  const saldoPagar = saquesSolicitados.reduce((s, r) => s + r.valorCentavos, 0)
  const saquesAtrasados = saquesSolicitados.filter(r => r.solicitadoEm && diasDesde(r.solicitadoEm) > 5).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card titulo="Conversões este mês" valor={String(conversoesMes)} />
        <Card titulo="Afiliados ativos" valor={String(afiliadosAtivos)} />
        <Card titulo="Saldo a pagar" valor={formatarValor(saldoPagar)} />
        <Card titulo="Saques atrasados" valor={String(saquesAtrasados)} destaque={saquesAtrasados > 0} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Últimas conversões</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Afiliado</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Produto</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Valor</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ultimasConversoes.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="px-6 py-3 text-gray-500">{c.criadoEm.toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-3 text-gray-700">{c.participacao.afiliado.nome}</td>
                <td className="px-6 py-3 text-gray-700">{c.produtoNome}</td>
                <td className="px-6 py-3 text-right text-gray-700">{formatarValor(c.valorCentavos)}</td>
                <td className="px-6 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {ultimasConversoes.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma conversão ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Card({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <p className="text-xs text-gray-400 font-medium mb-1">{titulo}</p>
      <p className={`text-2xl font-display font-bold ${destaque ? 'text-red-600' : 'text-gray-900'}`}>{valor}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    pendente: 'bg-yellow-50 text-yellow-700',
    confirmada: 'bg-green-50 text-green-700',
    cancelada: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
