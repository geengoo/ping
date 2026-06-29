import type { Campanha } from '@prisma/client'

export function calcularReward(campanha: Campanha, _valorConversaoCentavos: number): number {
  return campanha.recompensaValorCentavos
}
