import type { Campanha } from '@prisma/client'

export function calcularReward(campanha: Campanha, valorConversaoCentavos: number): number {
  if (campanha.recompensaTipo === 'fixo') {
    return campanha.recompensaValorCentavos
  }
  return Math.floor((campanha.recompensaValorCentavos / 100) * valorConversaoCentavos)
}
