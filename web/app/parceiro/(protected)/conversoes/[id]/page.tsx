import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function ConversaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const { id } = await params

  const conversao = await prisma.conversao.findFirst({
    where: {
      id,
      participacao: { campanha: { parceiroId: sessao.parceiroId } },
    },
    include: {
      participacao: { include: { afiliado: { select: { nome: true, email: true } } } },
      reward: true,
    },
  })

  if (!conversao) notFound()

  const linhas = [
    ['ID', conversao.id],
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

  const rewardLinhas = conversao.reward ? [
    ['Reward ID', conversao.reward.id],
    ['Valor reward', fmt(conversao.reward.valorCentavos)],
    ['Status reward', conversao.reward.status],
    ['Motivo reversão', conversao.reward.motivoReversao || '—'],
    ['Disponível em', conversao.reward.disponivelEm?.toLocaleString('pt-BR') || '—'],
    ['Solicitado em', conversao.reward.solicitadoEm?.toLocaleString('pt-BR') || '—'],
    ['Pago em', conversao.reward.pagoEm?.toLocaleString('pt-BR') || '—'],
  ] : []

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/parceiro/conversoes" className="text-gray-400 hover:text-gray-600 text-sm">← Conversões</Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">Detalhes da conversão</h1>
      </div>

      <Section titulo="Conversão" linhas={linhas} />
      {conversao.reward && <Section titulo="Reward associado" linhas={rewardLinhas} />}
    </div>
  )
}

function Section({ titulo, linhas }: { titulo: string; linhas: string[][] }) {
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
