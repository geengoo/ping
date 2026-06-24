import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'

let apiKey: string
let campanhaId: string
let parceiroContaId: string
let parceiroId: string

beforeAll(async () => {
  const conta = await prisma.conta.create({
    data: { nome: 'Parceiro Afiliados', email: 'parceiro-afiliados@ping.test', papeis: ['parceiro'] },
  })
  parceiroContaId = conta.id
  const parceiro = await prisma.parceiro.create({
    data: { contaId: conta.id, nomeFantasia: 'Teste Afiliados', apiKey: 'aff-key-456' },
  })
  parceiroId = parceiro.id
  apiKey = 'aff-key-456'

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Teste',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 5000,
    },
  })
  campanhaId = campanha.id
})

afterAll(async () => {
  await prisma.participacao.deleteMany({ where: { campanhaId } })
  await prisma.conta.deleteMany({ where: { email: { contains: '@aff-test.com' } } })
  await prisma.campanha.deleteMany({ where: { id: campanhaId } })
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { id: parceiroContaId } })
  await prisma.$disconnect()
})

describe('POST /v1/affiliates', () => {
  it('cria afiliado e participação, retorna link e código', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado1@aff-test.com', nome: 'Afiliado Um' })

    expect(res.status).toBe(201)
    expect(res.body.participacao_id).toBeDefined()
    expect(res.body.link).toMatch(/\/a\//)
    expect(res.body.codigo).toMatch(/^[A-Z0-9]{8}$/)
  })

  it('retorna participação existente se afiliado já existe', async () => {
    const res1 = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado2@aff-test.com', nome: 'Afiliado Dois' })

    const res2 = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado2@aff-test.com', nome: 'Afiliado Dois' })

    expect(res1.body.participacao_id).toBe(res2.body.participacao_id)
  })

  it('rejeita sem email', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ nome: 'Sem Email' })
    expect(res.status).toBe(400)
  })
})

describe('GET /v1/affiliates/:id/balance', () => {
  it('retorna saldo zerado para afiliado sem conversões', async () => {
    const criacaoRes = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado3@aff-test.com', nome: 'Afiliado Três' })

    const res = await request(app)
      .get(`/v1/affiliates/${criacaoRes.body.participacao_id}/balance`)
      .set('X-API-Key', apiKey)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ pendente: 0, disponivel: 0, solicitado: 0, pago: 0 })
  })
})
