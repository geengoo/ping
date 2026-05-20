import { NextRequest, NextResponse } from 'next/server'
import { gerarToken, setTokenCookie } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json()

  const adminEmail = process.env.SUPER_ADMIN_EMAIL
  const adminSenha = process.env.SUPER_ADMIN_SENHA || 'ping2026'

  if (email !== adminEmail || senha !== adminSenha) {
    return NextResponse.json({ erro: 'Credenciais inválidas' }, { status: 401 })
  }

  const token = gerarToken({ role: 'superadmin', email })
  const cookieOptions = setTokenCookie(token)
  const jar = await cookies()
  jar.set(cookieOptions)

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const jar = await cookies()
  jar.delete('ping_token')
  return NextResponse.json({ ok: true })
}
