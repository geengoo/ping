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
    expect(res.body.conversaoId).toBeDefined()
    expect(res.body.rewardId).toBeDefined()
    expect(res.body.reward_valor_centavos).toBeUndefined()
  })

  it('rejeita tipo de compra não elegível', async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: 'order-ineligible',
        customer_email: 'cliente2@exemplo.com',
        amount_cents: 14900,
        purchase_type: 'one_time',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/tipo de compra não elegível/)
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

describe('POST /v1/conversions/:id/cancel', () => {
  let conversaoId: string
  let rewardId: string

  beforeEach(async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: `order-cancel-${Date.now()}`,
        customer_email: 'cancelar@exemplo.com',
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })
    expect(res.status).toBe(201)
    conversaoId = res.body.conversaoId
    rewardId = res.body.rewardId
  })

  it('cancela conversão e reverte reward — nunca deleta', async () => {
    const res = await request(app)
      .post(`/v1/conversions/${conversaoId}/cancel`)
      .set('X-API-Key', apiKey)
      .send({ motivo: 'chargeback' })

    expect(res.status).toBe(200)
    expect(res.body.conversaoId).toBe(conversaoId)
    expect(res.body.status).toBe('cancelada')
    expect(res.body.motivo).toBe('chargeback')
    expect(res.body.rewardId).toBe(rewardId)
    expect(res.body.rewardStatus).toBe('revertido')

    // Verifica que o registro NÃO foi deletado — apenas atualizado
    const conversaoNoBanco = await prisma.conversao.findUnique({ where: { id: conversaoId } })
    expect(conversaoNoBanco).not.toBeNull()
    expect(conversaoNoBanco!.status).toBe('cancelada')
    expect(conversaoNoBanco!.motivoCancelamento).toBe('chargeback')

    // Verifica que o reward também foi apenas atualizado
    const rewardNoBanco = await prisma.reward.findUnique({ where: { id: rewardId } })
    expect(rewardNoBanco).not.toBeNull()
    expect(rewardNoBanco!.status).toBe('revertido')
    expect(rewardNoBanco!.motivoReversao).toBe('chargeback')
  })

  it('rejeita motivo inválido → 400', async () => {
    const resInvalido = await request(app)
      .post(`/v1/conversions/${conversaoId}/cancel`)
      .set('X-API-Key', apiKey)
      .send({ motivo: 'motivo-invalido' })

    expect(resInvalido.status).toBe(400)
    expect(resInvalido.body.error).toMatch(/motivo/)

    // Sem motivo também é 400
    const resSemMotivo = await request(app)
      .post(`/v1/conversions/${conversaoId}/cancel`)
      .set('X-API-Key', apiKey)
      .send({})

    expect(resSemMotivo.status).toBe(400)
  })

  it('não cancela conversão já cancelada → 409', async () => {
    // Primeiro cancel
    const primeiro = await request(app)
      .post(`/v1/conversions/${conversaoId}/cancel`)
      .set('X-API-Key', apiKey)
      .send({ motivo: 'cancelamento' })
    expect(primeiro.status).toBe(200)

    // Segundo cancel — deve retornar 409
    const segundo = await request(app)
      .post(`/v1/conversions/${conversaoId}/cancel`)
      .set('X-API-Key', apiKey)
      .send({ motivo: 'fraude' })
    expect(segundo.status).toBe(409)
    expect(segundo.body.error).toMatch(/já está cancelada/)
  })
})
