import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AfiliadoDashboard } from './AfiliadoDashboard'

export default async function AfiliadoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params

  const sessao = await getSessao()
  if (!sessao) redirect(`/a/login?next=/a/${codigo}`)

  const participacao = await prisma.participacao.findUnique({
    where: { codigoIndicacao: codigo },
    include: {
      afiliado: { select: { nome: true, email: true } },
      campanha: {
        include: {
          parceiro: { select: { nomeFantasia: true, razaoSocial: true } },
        },
      },
      conversoes: {
        orderBy: { criadoEm: 'desc' },
        take: 50,
        select: { criadoEm: true, produtoNome: true, nomeConvidado: true, emailConvidado: true, valorCentavos: true, status: true },
      },
      rewards: {
        select: { id: true, status: true, valorCentavos: true, solicitadoEm: true, pagoEm: true },
      },
    },
  })

  if (!participacao) redirect('/a/login')
  if (participacao.afiliadoId !== sessao.contaId) redirect('/a/login')

  const saldo = {
    pendente:   participacao.rewards.filter(r => r.status === 'pendente').reduce((s, r) => s + r.valorCentavos, 0),
    disponivel: participacao.rewards.filter(r => r.status === 'disponivel').reduce((s, r) => s + r.valorCentavos, 0),
    solicitado: participacao.rewards.filter(r => r.status === 'solicitado').reduce((s, r) => s + r.valorCentavos, 0),
    pago:       participacao.rewards.filter(r => r.status === 'pago').reduce((s, r) => s + r.valorCentavos, 0),
  }

  const nomeParceiro = participacao.campanha.parceiro.nomeFantasia || participacao.campanha.parceiro.razaoSocial || 'Parceiro'

  return (
    <AfiliadoDashboard
      nome={participacao.afiliado.nome}
      email={participacao.afiliado.email}
      linkIndicacao={participacao.linkIndicacao}
      codigoIndicacao={codigo}
      nomeParceiro={nomeParceiro}
      campanha={{
        nome: participacao.campanha.nome,
        recompensaTipo: participacao.campanha.recompensaTipo,
        recompensaValorCentavos: participacao.campanha.recompensaValorCentavos,
      }}
      saldo={saldo}
      conversoes={participacao.conversoes.map(c => ({
        ...c,
        criadoEm: c.criadoEm.toISOString(),
        nomeConvidado: c.nomeConvidado ?? null,
      }))}
      temSaldoDisponivel={saldo.disponivel > 0}
    />
  )
}
