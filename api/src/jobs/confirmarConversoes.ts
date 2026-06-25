import { prisma } from '../lib/prisma'
import { notificarAfiliadoRewardDisponivel } from '../lib/resend'

export async function confirmarConversoes() {
  const agora = new Date()

  const conversoes = await prisma.conversao.findMany({
    where: { status: 'pendente' },
    include: {
      participacao: {
        include: {
          campanha: { include: { parceiro: true } },
          afiliado: true,
        },
      },
      reward: true,
    },
  })

  let confirmadas = 0

  for (const conversao of conversoes) {
    const janelaDias = conversao.participacao.campanha.janelaCancelamentoDias
    const expiraEm = new Date(conversao.criadoEm)
    expiraEm.setDate(expiraEm.getDate() + janelaDias)
    if (expiraEm > agora) continue

    await prisma.$transaction(async (tx) => {
      await tx.conversao.update({
        where: { id: conversao.id },
        data: { status: 'confirmada', confirmadoEm: agora },
      })

      if (conversao.reward) {
        await tx.reward.update({
          where: { id: conversao.reward!.id },
          data: { status: 'disponivel', disponivelEm: agora },
        })
      }

      const webhookUrl = conversao.participacao.campanha.parceiro.webhookUrl
      if (webhookUrl) {
        await tx.webhookLog.create({
          data: {
            parceiroId: conversao.participacao.campanha.parceiroId,
            evento: 'conversion.confirmed',
            payload: {
              conversaoId: conversao.id,
              participacaoId: conversao.participacaoId,
              rewardId: conversao.reward?.id ?? null,
            },
            url: webhookUrl,
            tentativas: 0,
            sucesso: false,
          },
        })
      }
    })

    try {
      await notificarAfiliadoRewardDisponivel(
        conversao.participacao.afiliado.email,
        conversao.reward?.valorCentavos ?? 0,
        process.env.WEB_BASE_URL ?? ''
      )
    } catch (err) {
      console.error(`[confirmarConversoes] falha ao notificar afiliado reward ${conversao.reward?.id}:`, err)
    }

    confirmadas++
  }

  console.log(`[confirmarConversoes] ${confirmadas} conversão(ões) confirmada(s)`)
}
