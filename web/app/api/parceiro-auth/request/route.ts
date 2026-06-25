import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarCodigoLogin } from '@/lib/resend'

function gerarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string }
  if (!email) return NextResponse.json({ error: 'email obrigatório' }, { status: 400 })

  const conta = await prisma.conta.findUnique({
    where: { email },
    include: { parceiro: true },
  })

  if (!conta?.parceiro) {
    return NextResponse.json({ error: 'nenhum parceiro associado a este email' }, { status: 404 })
  }

  await prisma.tokenAcesso.updateMany({
    where: { contaId: conta.id, usado: false },
    data: { usado: true },
  })

  const codigo = gerarCodigo()
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000)
  await prisma.tokenAcesso.create({ data: { contaId: conta.id, codigo, expiraEm } })

  await enviarCodigoLogin(email, codigo, process.env.NEXT_PUBLIC_BASE_URL || '')

  return NextResponse.json({ ok: true })
}
