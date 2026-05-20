import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const SECRET = process.env.JWT_SECRET!

export async function hashSenha(senha: string) {
  return bcrypt.hash(senha, 10)
}

export async function verificarSenha(senha: string, hash: string) {
  return bcrypt.compare(senha, hash)
}

export function gerarToken(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verificarToken(token: string) {
  try {
    return jwt.verify(token, SECRET) as jwt.JwtPayload
  } catch {
    return null
  }
}

export async function getSessao() {
  const jar = await cookies()
  const token = jar.get('ping_token')?.value
  if (!token) return null
  return verificarToken(token)
}

export function setTokenCookie(token: string) {
  return {
    name: 'ping_token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  }
}
