import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { calcularReward } from '../lib/reward'
import { validarSelfReferral } from '../lib/validate'

export const conversionsRouter = Router()

conversionsRouter.post('/', async (req, res) => {
  const {
    affiliate_id,
    order_id,
    customer_email,
    customer_id,
    amount_cents,
    purchase_type,
    product,
  } = req.body as {
    affiliate_id?: string
    order_id?: string
    customer_email?: string
    customer_id?: string
    amount_cents?: number
    purchase_type?: string
    product?: { name?: string; id?: string; description?: string }
  }

  if (!affiliate_id || !order_id || !customer_email || !amount_cents || !purchase_type || !product?.name) {
    return void res.status(400).json({ error: 'campos obrigatórios: affiliate_id, order_id, customer_email, amount_cents, purchase_type, product.name' })
  }

  const participacao = await prisma.participacao.findUnique({
    where: { id: affiliate_id },
    include: { campanha: true, afiliado: true },
  })
  if (!participacao) return void res.status(404).json({ error: 'participação não encontrada' })

  if (participacao.campanha.parceiroId !== req.parceiro.id) {
    return void res.status(403).json({ error: 'participação não pertence a este parceiro' })
  }

  if (participacao.campanha.status !== 'ativa') {
    return void res.status(422).json({ error: 'campanha não está ativa' })
  }

  if (validarSelfReferral(participacao.afiliado.email, customer_email)) {
    return void res.status(422).json({ error: 'self-referral não permitido' })
  }

  const existente = await prisma.conversao.findUnique({
    where: { participacaoId_pedidoIdExterno: { participacaoId: affiliate_id, pedidoIdExterno: order_id } },
  })
  if (existente) return void res.status(409).json({ error: 'pedido já registrado' })

  const rewardValor = calcularReward(participacao.campanha, amount_cents)

  const conversao = await prisma.conversao.create({
    data: {
      participacaoId: affiliate_id,
      pedidoIdExterno: order_id,
      emailConvidado: customer_email,
      convidadoIdExterno: customer_id,
      valorCentavos: amount_cents,
      tipoCompra: purchase_type,
      produtoNome: product.name,
      produtoIdExterno: product.id,
      produtoDescricao: product.description,
      reward: {
        create: {
          participacaoId: affiliate_id,
          tipo: participacao.campanha.recompensaTipo,
          valorCentavos: rewardValor,
        },
      },
    },
    include: { reward: true },
  })

  res.status(201).json({
    conversao_id: conversao.id,
    reward_id: conversao.reward!.id,
    reward_valor_centavos: conversao.reward!.valorCentavos,
    status: 'pendente',
  })
})

conversionsRouter.post('/:id/cancel', async (req, res) => {
  // implementado na Task 7
  res.status(501).json({ error: 'not implemented' })
})
