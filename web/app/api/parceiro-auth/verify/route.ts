import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarTokenParceiro, COOKIE_NAME } from '@/lib/parceiroAuth'

export async function POST(req: NextRequest) {
  const { email, codigo } = await req.json() as { email?: string; codigo?: string }
  if (!email || !codigo) {
    return NextResponse.json({ error: 'email e código obrigatórios' }, { status: 400 })
  }

  const conta = await prisma.conta.findUnique({
    where: { email },
    include: { parceiro: true },
  })

  if (!conta?.parceiro || conta.parceiro.status !== 'ativo') {
    return NextResponse.json({ error: 'conta não encontrada' }, { status: 401 })
  }

  const token = await prisma.tokenAcesso.findFirst({
    where: { contaId: conta.id, codigo, usado: false, expiraEm: { gt: new Date() } },
  })

  if (!token) return NextResponse.json({ error: 'código inválido ou expirado' }, { status: 401 })

  await prisma.tokenAcesso.update({ where: { id: token.id }, data: { usado: true } })

  const jwt = await criarTokenParceiro({
    parceiroId: conta.parceiro.id,
    contaId: conta.id,
    email: conta.email,
  })

  const res = NextResponse.json({ redirectTo: '/parceiro/dashboard' })
  res.cookies.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
