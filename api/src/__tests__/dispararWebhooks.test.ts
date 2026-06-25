import { prisma } from '../lib/prisma'
import { dispararWebhooks } from '../jobs/dispararWebhooks'

let parceiroId: string

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

beforeAll(async () => {
  const conta = await prisma.conta.create({
    data: { nome: 'Parceiro Webhook', email: 'parceiro-webhook@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: {
      contaId: conta.id,
      nomeFantasia: 'Webhook Parceiro',
      apiKey: 'webhook-key-001',
      webhookUrl: 'https://example.com/webhook',
    },
  })
  parceiroId = parceiro.id
})

afterAll(async () => {
  await prisma.webhookLog.deleteMany({ where: { parceiroId } })
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { email: 'parceiro-webhook@ping.test' } })
  await prisma.$disconnect()
})

beforeEach(() => mockFetch.mockReset())

describe('dispararWebhooks', () => {
  it('dispara webhook pendente com sucesso e marca sucesso=true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const log = await prisma.webhookLog.create({
      data: {
        parceiroId,
        evento: 'conversion.confirmed',
        payload: { conversaoId: 'abc-123' },
        url: 'https://example.com/webhook',
        tentativas: 0,
        sucesso: false,
      },
    })

    await dispararWebhooks()

    const atualizado = await prisma.webhookLog.findUnique({ where: { id: log.id } })
    expect(atualizado!.sucesso).toBe(true)
    expect(atualizado!.tentativas).toBe(1)
    expect(atualizado!.statusCode).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('incrementa tentativas e registra erro quando webhook retorna 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const log = await prisma.webhookLog.create({
      data: {
        parceiroId,
        evento: 'payout.overdue',
        payload: { rewardId: 'xyz-456' },
        url: 'https://example.com/webhook',
        tentativas: 0,
        sucesso: false,
      },
    })

    await dispararWebhooks()

    const atualizado = await prisma.webhookLog.findUnique({ where: { id: log.id } })
    expect(atualizado!.sucesso).toBe(false)
    expect(atualizado!.tentativas).toBe(1)
    expect(atualizado!.statusCode).toBe(500)
    expect(atualizado!.erro).toBe('HTTP 500')
  })

  it('não reprocessa webhook com tentativas >= 4', async () => {
    const log = await prisma.webhookLog.create({
      data: {
        parceiroId,
        evento: 'conversion.created',
        payload: { conversaoId: 'esgotado' },
        url: 'https://example.com/webhook',
        tentativas: 4,
        sucesso: false,
        tentadoEm: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    })

    await dispararWebhooks()

    expect(mockFetch).not.toHaveBeenCalled()
    const naoAlterado = await prisma.webhookLog.findUnique({ where: { id: log.id } })
    expect(naoAlterado!.tentativas).toBe(4)
  })

  it('respeita backoff — não dispara na 2ª tentativa antes de 1h', async () => {
    const log = await prisma.webhookLog.create({
      data: {
        parceiroId,
        evento: 'payout.requested',
        payload: { rewardId: 'backoff-abc' },
        url: 'https://example.com/webhook',
        tentativas: 1,
        sucesso: false,
        tentadoEm: new Date(Date.now() - 30 * 60 * 1000), // 30min atrás < 1h
      },
    })

    await dispararWebhooks()

    expect(mockFetch).not.toHaveBeenCalled()
    const naoAlterado = await prisma.webhookLog.findUnique({ where: { id: log.id } })
    expect(naoAlterado!.tentativas).toBe(1)
  })
})
