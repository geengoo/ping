import { prisma } from '../lib/prisma'
import { confirmarConversoes } from '../jobs/confirmarConversoes'

let parceiroId: string
let campanhaId: string
let participacaoId: string

beforeAll(async () => {
  const contaParceiro = await prisma.conta.create({
    data: { nome: 'Parceiro Worker', email: 'parceiro-worker@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: {
      contaId: contaParceiro.id,
      nomeFantasia: 'Worker Parceiro',
      apiKey: 'worker-key-001',
      webhookUrl: 'https://example.com/webhook',
      contatoEmail: 'parceiro-worker@ping.test',
    },
  })
  parceiroId = parceiro.id

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Worker',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 5000,
      janelaCancelamentoDias: 30,
    },
  })
  campanhaId = campanha.id

  const contaAfil = await prisma.conta.create({
    data: { nome: 'Afiliado Worker', email: 'afil-worker@ping.test', papeis: ['afiliado'] },
  })

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: contaAfil.id,
      codigoIndicacao: 'WORKERTEST',
      linkIndicacao: 'https://ping.geengoo.io/a/WORKERTEST',
    },
  })
  participacaoId = participacao.id
})

afterAll(async () => {
  await prisma.webhookLog.deleteMany({ where: { parceiroId } })
  await prisma.reward.deleteMany({ where: { participacaoId } })
  await prisma.conversao.deleteMany({ where: { participacaoId } })
  await prisma.participacao.deleteMany({ where: { id: participacaoId } })
  await prisma.campanha.deleteMany({ where: { id: campanhaId } })
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { email: { in: ['parceiro-worker@ping.test', 'afil-worker@ping.test'] } } })
  await prisma.$disconnect()
})

describe('confirmarConversoes', () => {
  it('confirma conversão cuja janela de cancelamento expirou', async () => {
    const passado = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    const conversao = await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'order-worker-001',
        emailConvidado: 'cliente-worker@ping.test',
        valorCentavos: 14900,
        tipoCompra: 'subscription',
        produtoNome: 'Plano Mensal',
        criadoEm: passado,
        reward: {
          create: { participacaoId, tipo: 'fixo', valorCentavos: 5000, status: 'pendente' },
        },
      },
      include: { reward: true },
    })

    await confirmarConversoes()

    const conv = await prisma.conversao.findUnique({ where: { id: conversao.id } })
    expect(conv!.status).toBe('confirmada')
    expect(conv!.confirmadoEm).not.toBeNull()

    const rew = await prisma.reward.findUnique({ where: { id: conversao.reward!.id } })
    expect(rew!.status).toBe('disponivel')
    expect(rew!.disponivelEm).not.toBeNull()

    const log = await prisma.webhookLog.findFirst({
      where: { parceiroId, evento: 'conversion.confirmed' },
    })
    expect(log).not.toBeNull()
    expect(log!.sucesso).toBe(false)
    expect(log!.tentativas).toBe(0)
  })

  it('não toca conversão dentro da janela de cancelamento', async () => {
    const recente = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    const conversao = await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'order-worker-002',
        emailConvidado: 'cliente-worker2@ping.test',
        valorCentavos: 9900,
        tipoCompra: 'subscription',
        produtoNome: 'Plano Mensal',
        criadoEm: recente,
        reward: {
          create: { participacaoId, tipo: 'fixo', valorCentavos: 5000, status: 'pendente' },
        },
      },
    })

    await confirmarConversoes()

    const conv = await prisma.conversao.findUnique({ where: { id: conversao.id } })
    expect(conv!.status).toBe('pendente')
  })

  it('é idempotente — não reprocessa conversão já confirmada', async () => {
    const passado = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'order-worker-003',
        emailConvidado: 'cliente-worker3@ping.test',
        valorCentavos: 9900,
        tipoCompra: 'subscription',
        produtoNome: 'Plano Mensal',
        status: 'confirmada',
        confirmadoEm: new Date(),
        criadoEm: passado,
        reward: {
          create: { participacaoId, tipo: 'fixo', valorCentavos: 5000, status: 'disponivel' },
        },
      },
    })

    const logsBefore = await prisma.webhookLog.count({ where: { parceiroId, evento: 'conversion.confirmed' } })
    await confirmarConversoes()
    const logsAfter = await prisma.webhookLog.count({ where: { parceiroId, evento: 'conversion.confirmed' } })

    expect(logsAfter).toBe(logsBefore)
  })
})
