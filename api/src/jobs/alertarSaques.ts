import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import {
  alertarParceiroLembrete,
  alertarParceiroVencido,
  alertarSuperadminSaqueVencido,
} from '../lib/resend'

const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret'
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3041'
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || ''

function gerarToken(rewardId: string, action: 'confirm' | 'dispute'): string {
  return jwt.sign({ rewardId, action }, WORKER_SECRET, { algorithm: 'HS256', expiresIn: '7d' })
}

export async function alertarSaques() {
  const agora = new Date()

  const rewards = await prisma.reward.findMany({
    where: { status: 'solicitado' },
    include: {
      participacao: {
        include: {
          campanha: { include: { parceiro: true } },
          afiliado: true,
        },
      },
    },
  })

  for (const reward of rewards) {
    if (!reward.solicitadoEm) continue

    const diasDecorridos = Math.floor(
      (agora.getTime() - reward.solicitadoEm.getTime()) / (1000 * 60 * 60 * 24)
    )

    const parceiro = reward.participacao.campanha.parceiro
    const afiliado = reward.participacao.afiliado
    const emailParceiro = parceiro.contatoEmail
    if (!emailParceiro) continue

    if (diasDecorridos >= 3 && !reward.alertaD3EnviadoEm) {
      await alertarParceiroLembrete(emailParceiro, afiliado.nome, reward.valorCentavos)
      await prisma.reward.update({
        where: { id: reward.id },
        data: { alertaD3EnviadoEm: agora },
      })
    }

    if (diasDecorridos >= 5 && !reward.alertaD5EnviadoEm) {
      const tokenConfirm = gerarToken(reward.id, 'confirm')
      const tokenDispute = gerarToken(reward.id, 'dispute')

      await alertarParceiroVencido(
        emailParceiro,
        afiliado.nome,
        reward.valorCentavos,
        `${WEB_BASE_URL}/payout/${tokenConfirm}/confirm`,
        `${WEB_BASE_URL}/payout/${tokenDispute}/dispute`
      )

      if (SUPERADMIN_EMAIL) {
        await alertarSuperadminSaqueVencido(SUPERADMIN_EMAIL, afiliado.nome, reward.valorCentavos, reward.id)
      }

      if (parceiro.webhookUrl) {
        await prisma.webhookLog.create({
          data: {
            parceiroId: parceiro.id,
            evento: 'payout.overdue',
            payload: {
              rewardId: reward.id,
              participacaoId: reward.participacaoId,
              valorCentavos: reward.valorCentavos,
            },
            url: parceiro.webhookUrl,
            tentativas: 0,
            sucesso: false,
          },
        })
      }

      await prisma.reward.update({
        where: { id: reward.id },
        data: { alertaD5EnviadoEm: agora },
      })
    }
  }
}
