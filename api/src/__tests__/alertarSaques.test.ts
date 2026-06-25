import { prisma } from '../lib/prisma'
import { alertarSaques } from '../jobs/alertarSaques'

let parceiroId: string
let campanhaId: string
let participacaoId: string

beforeAll(async () => {
  const contaParceiro = await prisma.conta.create({
    data: { nome: 'Parceiro Alertas', email: 'parceiro-alertas@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: {
      contaId: contaParceiro.id,
      nomeFantasia: 'Alertas Parceiro',
      apiKey: 'alertas-key-001',
      webhookUrl: 'https://example.com/webhook',
      contatoEmail: 'parceiro-alertas@ping.test',
    },
  })
  parceiroId = parceiro.id

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Alertas',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 5000,
      janelaCancelamentoDias: 30,
    },
  })
  campanhaId = campanha.id

  const contaAfil = await prisma.conta.create({
    data: { nome: 'Afiliado Alertas', email: 'afil-alertas@ping.test', papeis: ['afiliado'] },
  })

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: contaAfil.id,
      codigoIndicacao: 'ALERTATEST',
      linkIndicacao: 'https://ping.geengoo.io/a/ALERTATEST',
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
  await prisma.conta.deleteMany({ where: { email: { in: ['parceiro-alertas@ping.test', 'afil-alertas@ping.test'] } } })
  await prisma.$disconnect()
})

async function criarRewardSolicitado(diasAtras: number, sufixo: string) {
  const solicitadoEm = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)
  const conv = await prisma.conversao.create({
    data: {
      participacaoId,
      pedidoIdExterno: `order-alerta-${sufixo}`,
      emailConvidado: `cliente-${sufixo}@ping.test`,
      valorCentavos: 14900,
      tipoCompra: 'subscription',
      produtoNome: 'Plano Mensal',
      status: 'confirmada',
      confirmadoEm: new Date(),
    },
  })
  return prisma.reward.create({
    data: {
      conversaoId: conv.id,
      participacaoId,
      tipo: 'fixo',
      valorCentavos: 5000,
      status: 'solicitado',
      solicitadoEm,
    },
  })
}

describe('alertarSaques', () => {
  it('seta alertaD3EnviadoEm para reward com 3+ dias solicitado', async () => {
    const reward = await criarRewardSolicitado(3, 'd3')

    await alertarSaques()

    const atualizado = await prisma.reward.findUnique({ where: { id: reward.id } })
    expect(atualizado!.alertaD3EnviadoEm).not.toBeNull()
    expect(atualizado!.alertaD5EnviadoEm).toBeNull()
  })

  it('não reenvia D+3 se alertaD3EnviadoEm já preenchido', async () => {
    const reward = await criarRewardSolicitado(3, 'd3-dup')
    const timestampOriginal = new Date(Date.now() - 1000)
    await prisma.reward.update({
      where: { id: reward.id },
      data: { alertaD3EnviadoEm: timestampOriginal },
    })

    await alertarSaques()

    const atualizado = await prisma.reward.findUnique({ where: { id: reward.id } })
    expect(atualizado!.alertaD3EnviadoEm!.getTime()).toBe(timestampOriginal.getTime())
  })

  it('seta alertaD5EnviadoEm e cria webhookLog payout.overdue para reward com 5+ dias', async () => {
    const reward = await criarRewardSolicitado(5, 'd5')

    await alertarSaques()

    const atualizado = await prisma.reward.findUnique({ where: { id: reward.id } })
    expect(atualizado!.alertaD5EnviadoEm).not.toBeNull()

    const log = await prisma.webhookLog.findFirst({
      where: { parceiroId, evento: 'payout.overdue' },
      orderBy: { criadoEm: 'desc' },
    })
    expect(log).not.toBeNull()
    expect(log!.sucesso).toBe(false)
    expect(log!.tentativas).toBe(0)
  })

  it('não reenvia D+5 se alertaD5EnviadoEm já preenchido', async () => {
    const reward = await criarRewardSolicitado(5, 'd5-dup')
    await prisma.reward.update({
      where: { id: reward.id },
      data: { alertaD5EnviadoEm: new Date() },
    })

    const logsAntes = await prisma.webhookLog.count({ where: { parceiroId, evento: 'payout.overdue' } })
    await alertarSaques()
    const logsDepois = await prisma.webhookLog.count({ where: { parceiroId, evento: 'payout.overdue' } })

    expect(logsDepois).toBe(logsAntes)
  })
})
