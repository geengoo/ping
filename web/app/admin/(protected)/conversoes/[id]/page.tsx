import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AdminConversaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const { id } = await params

  const conversao = await prisma.conversao.findUnique({
    where: { id },
    include: {
      participacao: {
        include: {
          afiliado: { select: { nome: true, email: true } },
          campanha: { include: { parceiro: { select: { nomeFantasia: true, razaoSocial: true } } } },
        },
      },
      reward: true,
    },
  })

  if (!conversao) notFound()

  const nomeParceiro = conversao.participacao.campanha.parceiro.nomeFantasia || conversao.participacao.campanha.parceiro.razaoSocial || '—'

  const linhas: [string, string][] = [
    ['ID', conversao.id],
    ['Parceiro', nomeParceiro],
    ['Pedido externo', conversao.pedidoIdExterno],
    ['Email convidado', conversao.emailConvidado],
    ['Produto', conversao.produtoNome],
    ['Valor', fmt(conversao.valorCentavos)],
    ['Tipo compra', conversao.tipoCompra],
    ['Status', conversao.status],
    ['Motivo cancelamento', conversao.motivoCancelamento || '—'],
    ['Criado em', conversao.criadoEm.toLocaleString('pt-BR')],
    ['Confirmado em', conversao.confirmadoEm?.toLocaleString('pt-BR') || '—'],
    ['Afiliado', conversao.participacao.afiliado.nome],
    ['Email afiliado', conversao.participacao.afiliado.email],
  ]

  const rewardLinhas: [string, string][] = conversao.reward ? [
    ['Reward ID', conversao.reward.id],
    ['Valor reward', fmt(conversao.reward.valorCentavos)],
    ['Status reward', conversao.reward.status],
    ['Disponível em', conversao.reward.disponivelEm?.toLocaleString('pt-BR') || '—'],
    ['Solicitado em', conversao.reward.solicitadoEm?.toLocaleString('pt-BR') || '—'],
    ['Pago em', conversao.reward.pagoEm?.toLocaleString('pt-BR') || '—'],
  ] : []

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/conversoes" className="text-gray-400 hover:text-gray-600 text-sm">← Conversões</Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">Detalhe da conversão</h1>
      </div>
      <Section titulo="Conversão" linhas={linhas} />
      {conversao.reward && <Section titulo="Reward" linhas={rewardLinhas} />}
    </div>
  )
}

function Section({ titulo, linhas }: { titulo: string; linhas: [string, string][] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">{titulo}</h2>
      </div>
      <dl className="divide-y divide-gray-100">
        {linhas.map(([k, v]) => (
          <div key={k} className="px-6 py-3 flex gap-4">
            <dt className="text-xs text-gray-400 w-36 shrink-0 pt-0.5">{k}</dt>
            <dd className="text-sm text-gray-700 break-all">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
