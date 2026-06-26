import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { IndicarForm } from './IndicarForm'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function IndicarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const parceiro = await prisma.parceiro.findUnique({
    where: { slug },
    include: { campanhas: { where: { status: 'ativa' }, take: 1 } },
  })

  if (!parceiro || parceiro.campanhas.length === 0) notFound()

  const campanha = parceiro.campanhas[0]
  const nomeParceiro = parceiro.nomeFantasia || parceiro.razaoSocial || 'Parceiro'
  const recompensaLabel = campanha.recompensaTipo === 'pix'
    ? `PIX (${fmt(campanha.recompensaValorCentavos)})`
    : `crédito (${fmt(campanha.recompensaValorCentavos)})`

  const descricao = campanha.descricao ||
    `Indique amigos para ${nomeParceiro} e ganhe ${fmt(campanha.recompensaValorCentavos)} por cada indicação confirmada.`

  return (
    <main className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-900 px-8 py-8 text-white">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{nomeParceiro}</p>
            <h1 className="text-2xl font-bold leading-tight">Programa de indicações</h1>
            <p className="mt-3 text-gray-300 text-sm leading-relaxed">{descricao}</p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
              <span className="text-white font-bold text-lg">{fmt(campanha.recompensaValorCentavos)}</span>
              <span className="text-gray-400 text-sm">por indicação via {campanha.recompensaTipo === 'pix' ? 'PIX' : 'crédito'}</span>
            </div>
          </div>

          <div className="px-8 py-8">
            <h2 className="text-base font-semibold text-gray-900 mb-6">Cadastre-se e receba seu link</h2>
            <IndicarForm
              slug={slug}
              nomeParceiro={nomeParceiro}
              descricao={descricao}
              recompensaLabel={recompensaLabel}
            />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <strong>ping</strong>
        </p>
      </div>
    </main>
  )
}
