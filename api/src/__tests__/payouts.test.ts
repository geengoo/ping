import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'

let apiKey: string
let parceiroId: string
let rewardId: string
let afiliadoEmail: string
let participacaoId: string

beforeAll(async () => {
  const contaParceiro = await prisma.conta.create({
    data: { nome: 'Parceiro Payout', email: 'parceiro-payout@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: { contaId: contaParceiro.id, nomeFantasia: 'Payout Parceiro', apiKey: 'payout-key-000' },
  })
  apiKey = 'payout-key-000'
  parceiroId = parceiro.id

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Payout',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 3000,
      janelaCancelamentoDias: 30,
    },
  })

  afiliadoEmail = 'afil-payout@ping.test'
  const contaAfil = await prisma.conta.create({
    data: { nome: 'Afiliado Payout', email: afiliadoEmail, papeis: ['afiliado'] },
  })

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: contaAfil.id,
      codigoIndicacao: 'PAYTEST',
      linkIndicacao: 'https://ping.geengoo.io/a/PAYTEST',
    },
  })
  participacaoId = participacao.id

  const conversao = await prisma.conversao.create({
    data: {
      participacaoId: participacao.id,
      pedidoIdExterno: 'payout-order-001',
      emailConvidado: 'cliente-payout@exemplo.com',
      valorCentavos: 9900,
      tipoCompra: 'subscription',
      produtoNome: 'Plano Mensal',
      reward: {
        create: {
          participacaoId: participacao.id,
          tipo: 'fixo',
          valorCentavos: 3000,
          status: 'solicitado',
        },
      },
    },
    include: { reward: true },
  })

  rewardId = conversao.reward!.id
})

afterAll(async () => {
  await prisma.reward.deleteMany({ where: { participacaoId } })
  await prisma.conversao.deleteMany({ where: { participacaoId } })
  await prisma.participacao.deleteMany({ where: { id: participacaoId } })
  await prisma.campanha.deleteMany({ where: { parceiroId } })
  await prisma.parceiro.deleteMany({ where: { apiKey } })
  await prisma.conta.deleteMany({ where: { email: { in: [afiliadoEmail, 'parceiro-payout@ping.test'] } } })
  await prisma.$disconnect()
})

describe('POST /v1/payouts/:id/confirm', () => {
  it('confirma pagamento → 200, body.status === pago, body.pagoEm definido', async () => {
    const res = await request(app)
      .post(`/v1/payouts/${rewardId}/confirm`)
      .set('X-API-Key', apiKey)

    expect(res.status).toBe(200)
    expect(res.body.rewardId).toBe(rewardId)
    expect(res.body.status).toBe('pago')
    expect(res.body.pagoEm).toBeDefined()
    expect(typeof res.body.pagoEm).toBe('string')
  })

  it('reward.status === pago e reward.pagoEm não é null no banco', async () => {
    const rewardNoBanco = await prisma.reward.findUnique({ where: { id: rewardId } })
    expect(rewardNoBanco).not.toBeNull()
    expect(rewardNoBanco!.status).toBe('pago')
    expect(rewardNoBanco!.pagoEm).not.toBeNull()
  })

  it('reward já pago → 409', async () => {
    const res = await request(app)
      .post(`/v1/payouts/${rewardId}/confirm`)
      .set('X-API-Key', apiKey)

    expect(res.status).toBe(409)
  })
})
