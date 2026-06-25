import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diasDesde(data: Date) {
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function AdminDashboardPage() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)

  const [parceirosAtivos, conversoesMes, saquesSolicitados] = await Promise.all([
    prisma.parceiro.count({ where: { status: 'ativo' } }),
    prisma.conversao.count({ where: { criadoEm: { gte: inicioMes } } }),
    prisma.reward.findMany({
      where: { status: 'solicitado' },
      select: { valorCentavos: true, solicitadoEm: true },
    }),
  ])

  const totalPagar = saquesSolicitados.reduce((s, r) => s + r.valorCentavos, 0)
  const saquesAtrasados = saquesSolicitados.filter(r => r.solicitadoEm && diasDesde(r.solicitadoEm) > 5).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card titulo="Parceiros ativos" valor={String(parceirosAtivos)} />
        <Card titulo="Conversões este mês" valor={String(conversoesMes)} />
        <Card titulo="Total a pagar" valor={fmt(totalPagar)} />
        <Card titulo="Saques atrasados" valor={String(saquesAtrasados)} destaque={saquesAtrasados > 0} />
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
