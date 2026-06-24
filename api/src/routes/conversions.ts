import { Router } from 'express'
import { Prisma } from '@prisma/client'
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

  const tiposElegiveis = participacao.campanha.tiposCompraElegiveis as string[]
  if (!tiposElegiveis.includes(purchase_type)) {
    return void res.status(422).json({ error: 'tipo de compra não elegível para esta campanha' })
  }

  if (validarSelfReferral(participacao.afiliado.email, customer_email)) {
    return void res.status(422).json({ error: 'self-referral não permitido' })
  }

  const rewardValor = calcularReward(participacao.campanha, amount_cents)

  try {
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
            status: 'pendente',
          },
        },
      },
      include: { reward: true },
    })

    res.status(201).json({
      conversaoId: conversao.id,
      rewardId: conversao.reward!.id,
      status: 'pendente',
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return void res.status(409).json({ error: 'pedido duplicado para esta participação' })
    }
    throw e
  }
})

conversionsRouter.post('/:id/cancel', async (req, res) => {
  // implementado na Task 7
  res.status(501).json({ error: 'not implemented' })
})
