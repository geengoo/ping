import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diasDesde(data: Date) {
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function AdminSaquesPage() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const rewards = await prisma.reward.findMany({
    where: { status: 'solicitado' },
    orderBy: { solicitadoEm: 'asc' },
    include: {
      participacao: {
        include: {
          afiliado: { select: { nome: true } },
          campanha: {
            include: { parceiro: { select: { id: true, nomeFantasia: true, razaoSocial: true, apiKey: true } } },
          },
        },
      },
    },
  })

  async function confirmarPagamento(rewardId: string) {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) return

    const reward = await prisma.reward.findUnique({
      where: { id: rewardId, status: 'solicitado' },
      include: { participacao: { include: { campanha: { include: { parceiro: { select: { apiKey: true } } } } } } },
    })
    if (!reward) return

    await fetch(`${process.env.API_BASE_URL}/v1/payouts/${rewardId}/confirm`, {
      method: 'POST',
      headers: { 'X-API-Key': reward.participacao.campanha.parceiro.apiKey },
    })

    revalidatePath('/admin/saques')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Saques pendentes</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Parceiro</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Afiliado</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Chave PIX</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Valor</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Aguardando</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rewards.map(r => {
              const dias = r.solicitadoEm ? diasDesde(r.solicitadoEm) : 0
              const atrasado = dias > 5
              const nomeParceiro = r.participacao.campanha.parceiro.nomeFantasia || r.participacao.campanha.parceiro.razaoSocial || '—'
              return (
                <tr key={r.id} className={`border-b border-gray-50 last:border-0 ${atrasado ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-3 text-gray-600 text-xs">{nomeParceiro}</td>
                  <td className="px-6 py-3 text-gray-700">{r.participacao.afiliado.nome}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{r.participacao.chavePix || '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-700 font-medium">{fmt(r.valorCentavos)}</td>
                  <td className={`px-6 py-3 text-sm ${atrasado ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {dias === 0 ? 'hoje' : `${dias} dia${dias > 1 ? 's' : ''}`}{atrasado && ' ⚠️'}
                  </td>
                  <td className="px-6 py-3">
                    <form action={confirmarPagamento.bind(null, r.id)}>
                      <button type="submit" className="px-3 py-1.5 bg-[#374151] text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors">
                        Confirmar
                      </button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {rewards.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum saque pendente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
