import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarCodigoLogin } from '@/lib/resend'

function gerarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: NextRequest) {
  const { email, nome } = await req.json() as { email?: string; nome?: string }
  if (!email) return NextResponse.json({ error: 'email obrigatório' }, { status: 400 })

  let conta = await prisma.conta.findUnique({ where: { email } })
  if (!conta) {
    conta = await prisma.conta.create({
      data: { email, nome: nome || email, papeis: [] },
    })
  }

  await prisma.tokenAcesso.updateMany({
    where: { contaId: conta.id, usado: false },
    data: { usado: true },
  })

  const codigo = gerarCodigo()
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000)

  await prisma.tokenAcesso.create({
    data: { contaId: conta.id, codigo, expiraEm },
  })

  await enviarCodigoLogin(email, codigo, process.env.NEXT_PUBLIC_BASE_URL || '')

  return NextResponse.json({ message: 'código enviado' })
}
