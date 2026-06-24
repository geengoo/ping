import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'

let apiKey: string
let participacaoId: string
let afiliadoEmail: string
let parceiroId: string

beforeAll(async () => {
  const contaParceiro = await prisma.conta.create({
    data: { nome: 'Parceiro Conv', email: 'parceiro-conv@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: { contaId: contaParceiro.id, nomeFantasia: 'Conv Parceiro', apiKey: 'conv-key-789' },
  })
  apiKey = 'conv-key-789'
  parceiroId = parceiro.id

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Conv',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 4000,
      janelaCancelamentoDias: 30,
    },
  })

  afiliadoEmail = 'afil-conv@ping.test'
  const contaAfil = await prisma.conta.create({
    data: { nome: 'Afiliado Conv', email: afiliadoEmail, papeis: ['afiliado'] },
  })

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: contaAfil.id,
      codigoIndicacao: 'CONVTEST',
      linkIndicacao: 'https://ping.geengoo.io/a/CONVTEST',
    },
  })
  participacaoId = participacao.id
})

afterAll(async () => {
  await prisma.reward.deleteMany({ where: { participacaoId } })
  await prisma.conversao.deleteMany({ where: { participacaoId } })
  await prisma.participacao.deleteMany({ where: { id: participacaoId } })
  await prisma.campanha.deleteMany({ where: { parceiroId } })
  await prisma.parceiro.deleteMany({ where: { apiKey } })
  await prisma.conta.deleteMany({ where: { email: { in: [afiliadoEmail, 'parceiro-conv@ping.test'] } } })
  await prisma.$disconnect()
})

describe('POST /v1/conversions', () => {
  it('cria conversão e reward com status pendente', async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: 'order-001',
        customer_email: 'cliente@exemplo.com',
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pendente')
    expect(res.body.conversao_id).toBeDefined()
    expect(res.body.reward_id).toBeDefined()
    expect(res.body.reward_valor_centavos).toBe(4000)
  })

  it('rejeita self-referral', async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: 'order-self',
        customer_email: afiliadoEmail,
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/self-referral/)
  })

  it('rejeita pedido duplicado', async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: 'order-001',
        customer_email: 'outro@exemplo.com',
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })

    expect(res.status).toBe(409)
  })
})
