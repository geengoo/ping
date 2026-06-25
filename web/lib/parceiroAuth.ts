import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
export const COOKIE_NAME = 'ping_parceiro_token'

export interface SessaoParceiro {
  parceiroId: string
  contaId: string
  email: string
}

export async function criarTokenParceiro(payload: SessaoParceiro): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verificarTokenParceiro(token: string): Promise<SessaoParceiro | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessaoParceiro
  } catch {
    return null
  }
}

export async function getSessaoParceiro(): Promise<SessaoParceiro | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  return verificarTokenParceiro(token)
}
