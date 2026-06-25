import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, codigo } = await req.json() as { email?: string; codigo?: string }
  if (!email || !codigo) {
    return NextResponse.json({ error: 'email e código obrigatórios' }, { status: 400 })
  }

  const conta = await prisma.conta.findUnique({ where: { email } })
  if (!conta) return NextResponse.json({ error: 'conta não encontrada' }, { status: 401 })

  const token = await prisma.tokenAcesso.findFirst({
    where: {
      contaId: conta.id,
      codigo,
      usado: false,
      expiraEm: { gt: new Date() },
    },
  })

  if (!token) return NextResponse.json({ error: 'código inválido ou expirado' }, { status: 401 })

  await prisma.tokenAcesso.update({ where: { id: token.id }, data: { usado: true } })

  const jwt = await criarToken({ contaId: conta.id, email: conta.email, papeis: conta.papeis })

  const isSuperadmin = conta.papeis.includes('superadmin')
  const redirectTo = isSuperadmin ? '/admin/dashboard' : `/a/${await getCodigoAfiliado(conta.id)}`

  const res = NextResponse.json({ redirectTo })
  res.cookies.set('ping_token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return res
}

async function getCodigoAfiliado(contaId: string): Promise<string> {
  const participacao = await prisma.participacao.findFirst({
    where: { afiliadoId: contaId },
    orderBy: { entrouEm: 'desc' },
  })
  return participacao?.codigoIndicacao ?? 'login'
}
