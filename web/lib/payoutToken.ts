import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.WORKER_SECRET || 'dev-secret')

export type PayoutTokenPayload = {
  rewardId: string
  action: 'confirm' | 'dispute'
}

export async function verificarPayoutToken(
  token: string,
  actionEsperada: 'confirm' | 'dispute'
): Promise<PayoutTokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  if (typeof payload.rewardId !== 'string' || payload.action !== actionEsperada) {
    throw new Error('token inválido ou ação incorreta')
  }
  return { rewardId: payload.rewardId, action: payload.action as 'confirm' | 'dispute' }
}
