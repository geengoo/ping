import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { notificarAfiliadoPago } from '../lib/resend'

export const payoutsRouter = Router()

payoutsRouter.post('/:id/confirm', async (req, res) => {
  const reward = await prisma.reward.findUnique({
    where: { id: req.params.id },
    include: {
      participacao: {
        include: {
          afiliado: true,
          campanha: true,
        },
      },
    },
  })

  if (!reward) {
    return void res.status(404).json({ error: 'reward não encontrado' })
  }

  if (reward.participacao.campanha.parceiroId !== req.parceiro.id) {
    return void res.status(403).json({ error: 'reward não pertence a este parceiro' })
  }

  if (reward.status !== 'solicitado') {
    return void res.status(409).json({ error: `reward com status '${reward.status}' não pode ser confirmado` })
  }

  const pagoEm = new Date()
  await prisma.reward.update({
    where: { id: reward.id },
    data: { status: 'pago', pagoEm },
  })

  await notificarAfiliadoPago(reward.participacao.afiliado.email, reward.valorCentavos)

  res.status(200).json({
    rewardId: reward.id,
    status: 'pago',
    pagoEm: pagoEm.toISOString(),
  })
})
