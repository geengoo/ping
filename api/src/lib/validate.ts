import { prisma } from './prisma'

export function gerarCodigoIndicacao(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function codigoUnico(): Promise<string> {
  let codigo: string
  let tentativas = 0
  do {
    codigo = gerarCodigoIndicacao()
    tentativas++
    if (tentativas > 20) throw new Error('não foi possível gerar código único')
  } while (await prisma.participacao.findUnique({ where: { codigoIndicacao: codigo } }))
  return codigo
}

export function validarSelfReferral(afiliadoEmail: string, convidadoEmail: string): boolean {
  return afiliadoEmail.toLowerCase() === convidadoEmail.toLowerCase()
}
