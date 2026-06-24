import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'

let parceiroId: string
let contaId: string

beforeAll(async () => {
  const conta = await prisma.conta.create({
    data: { nome: 'Teste Parceiro', email: 'parceiro-test@ping.test', papeis: ['parceiro'] },
  })
  contaId = conta.id
  const parceiro = await prisma.parceiro.create({
    data: { contaId: conta.id, nomeFantasia: 'Teste', apiKey: 'test-key-123' },
  })
  parceiroId = parceiro.id
})

afterAll(async () => {
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { id: contaId } })
  await prisma.$disconnect()
})

describe('API Key middleware', () => {
  it('rejeita request sem X-API-Key', async () => {
    const res = await request(app).post('/v1/affiliates').send({})
    expect(res.status).toBe(401)
  })

  it('rejeita X-API-Key inválida', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', 'chave-errada')
      .send({})
    expect(res.status).toBe(401)
  })

  it('aceita X-API-Key válida', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', 'test-key-123')
      .send({ email: 'afil@test.com', nome: 'Afiliado' })
    expect(res.status).not.toBe(401)
  })
})
