import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { codigoUnico } from '../lib/validate'

export const affiliatesRouter = Router()

affiliatesRouter.post('/', async (req, res) => {
  const { email, nome, chavePix } = req.body as { email?: string; nome?: string; chavePix?: string }
  if (!email) return void res.status(400).json({ error: 'email obrigatório' })
  if (!chavePix) return void res.status(400).json({ error: 'chavePix é obrigatória' })

  const parceiro = req.parceiro

  const campanha = await prisma.campanha.findFirst({
    where: { parceiroId: parceiro.id, status: 'ativa' },
  })
  if (!campanha) return void res.status(422).json({ error: 'nenhuma campanha ativa para este parceiro' })

  let conta = await prisma.conta.findUnique({ where: { email } })
  if (!conta) {
    conta = await prisma.conta.create({
      data: { email, nome: nome || email, papeis: ['afiliado'] },
    })
  } else if (!conta.papeis.includes('afiliado')) {
    await prisma.conta.update({
      where: { id: conta.id },
      data: { papeis: { push: 'afiliado' } },
    })
  }

  const existente = await prisma.participacao.findUnique({
    where: { campanhaId_afiliadoId: { campanhaId: campanha.id, afiliadoId: conta.id } },
  })
  if (existente) {
    return void res.status(409).json({ error: 'afiliado já cadastrado nesta campanha' })
  }

  const codigo = await codigoUnico()
  const baseUrl = process.env.BASE_URL || 'https://ping.geengoo.io'
  const link = `${baseUrl}/a/${codigo}`

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: conta.id,
      codigoIndicacao: codigo,
      linkIndicacao: link,
      chavePix,
    },
  })

  res.status(201).json({ participacaoId: participacao.id, linkIndicacao: link, codigoIndicacao: codigo })
})

affiliatesRouter.get('/:id/balance', async (req, res) => {
  const { id } = req.params

  const participacao = await prisma.participacao.findUnique({
    where: { id },
    include: { campanha: true },
  })

  if (!participacao) return void res.status(404).json({ error: 'participação não encontrada' })
  if (participacao.campanha.parceiroId !== req.parceiro.id) {
    return void res.status(403).json({ error: 'participação não pertence a este parceiro' })
  }

  const rewards = await prisma.reward.findMany({
    where: { participacaoId: id },
  })

  const somar = (status: string) =>
    rewards.filter((r) => r.status === status).reduce((acc: number, r) => acc + r.valorCentavos, 0)

  res.json({
    pendente: somar('pendente'),
    disponivel: somar('disponivel'),
    solicitado: somar('solicitado'),
    pago: somar('pago'),
  })
})
