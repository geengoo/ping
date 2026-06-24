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
  await prisma.reward.deleteMany({ where: { participacao: { campanhaId } } })
  await prisma.conversao.deleteMany({ where: { participacao: { campanhaId } } })
  await prisma.participacao.deleteMany({ where: { campanhaId } })
  await prisma.conta.deleteMany({ where: { email: { contains: '@aff-test.com' } } })
  await prisma.campanha.deleteMany({ where: { id: campanhaId } })
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { id: parceiroContaId } })
  await prisma.$disconnect()
})

describe('POST /v1/affiliates', () => {
  it('cria afiliado e participação, retorna participacaoId, linkIndicacao e codigoIndicacao', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado1@aff-test.com', nome: 'Afiliado Um', chavePix: 'afiliado1@pix.com' })

    expect(res.status).toBe(201)
    expect(res.body.participacaoId).toBeDefined()
    expect(res.body.linkIndicacao).toMatch(/\/a\//)
    expect(res.body.codigoIndicacao).toMatch(/^[A-Z0-9]{8}$/)
  })

  it('retorna 409 se afiliado já cadastrado na campanha', async () => {
    await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado2@aff-test.com', nome: 'Afiliado Dois', chavePix: 'afiliado2@pix.com' })

    const res2 = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado2@aff-test.com', nome: 'Afiliado Dois', chavePix: 'afiliado2@pix.com' })

    expect(res2.status).toBe(409)
    expect(res2.body.error).toBe('afiliado já cadastrado nesta campanha')
  })

  it('rejeita sem email', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ nome: 'Sem Email', chavePix: 'semEmail@pix.com' })
    expect(res.status).toBe(400)
  })

  it('rejeita sem chavePix', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado-sem-pix@aff-test.com', nome: 'Sem Pix' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('chavePix é obrigatória')
  })
})

describe('GET /v1/affiliates/:id/balance', () => {
  it('retorna saldo zerado para afiliado sem conversões', async () => {
    const criacaoRes = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado3@aff-test.com', nome: 'Afiliado Três', chavePix: 'afiliado3@pix.com' })

    expect(criacaoRes.status).toBe(201)

    const res = await request(app)
      .get(`/v1/affiliates/${criacaoRes.body.participacaoId}/balance`)
      .set('X-API-Key', apiKey)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ pendente: 0, disponivel: 0, solicitado: 0, pago: 0 })
  })

  it('soma rewards disponivel corretamente em centavos', async () => {
    const criacaoRes = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado4@aff-test.com', nome: 'Afiliado Quatro', chavePix: 'afiliado4@pix.com' })

    expect(criacaoRes.status).toBe(201)
    const participacaoId = criacaoRes.body.participacaoId

    // Cria conversões para vincular os rewards
    const conv1 = await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'pedido-bal-1',
        emailConvidado: 'conv1@aff-test.com',
        valorCentavos: 10000,
        tipoCompra: 'subscription',
        produtoNome: 'Produto Teste',
        status: 'confirmada',
      },
    })
    const conv2 = await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'pedido-bal-2',
        emailConvidado: 'conv2@aff-test.com',
        valorCentavos: 10000,
        tipoCompra: 'subscription',
        produtoNome: 'Produto Teste',
        status: 'confirmada',
      },
    })
    const conv3 = await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'pedido-bal-3',
        emailConvidado: 'conv3@aff-test.com',
        valorCentavos: 10000,
        tipoCompra: 'subscription',
        produtoNome: 'Produto Teste',
        status: 'pendente',
      },
    })

    await prisma.reward.create({
      data: { conversaoId: conv1.id, participacaoId, tipo: 'fixo', status: 'disponivel', valorCentavos: 3000 },
    })
    await prisma.reward.create({
      data: { conversaoId: conv2.id, participacaoId, tipo: 'fixo', status: 'disponivel', valorCentavos: 2000 },
    })
    await prisma.reward.create({
      data: { conversaoId: conv3.id, participacaoId, tipo: 'fixo', status: 'pendente', valorCentavos: 1000 },
    })

    const res = await request(app)
      .get(`/v1/affiliates/${participacaoId}/balance`)
      .set('X-API-Key', apiKey)

    expect(res.status).toBe(200)
    expect(res.body.disponivel).toBe(5000)
    expect(res.body.pendente).toBe(1000)
  })
})
