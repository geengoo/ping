import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE_NAME = 'ping_token'

export interface Sessao {
  contaId: string
  email: string
  papeis: string[]
}

export async function criarToken(payload: Sessao): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verificarToken(token: string): Promise<Sessao | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as Sessao
  } catch {
    return null
  }
}

export async function getSessao(): Promise<Sessao | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  return verificarToken(token)
}
