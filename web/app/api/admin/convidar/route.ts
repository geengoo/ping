import { NextRequest, NextResponse } from 'next/server'
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarConviteParceiro } from '@/lib/resend'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  let body: { email?: string; nomeContato?: string; nomeFantasia?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const { email, nomeContato, nomeFantasia } = body
  if (!email || !nomeContato || !nomeFantasia) {
    return NextResponse.json({ erro: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const conviteAtivo = await prisma.conviteParceiro.findFirst({
    where: { email, usado: false, expiraEm: { gt: new Date() } },
  })
  if (conviteAtivo) {
    return NextResponse.json({ erro: 'Já existe um convite ativo para este email.' }, { status: 409 })
  }

  const token = nanoid(32)
  const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.conviteParceiro.create({
    data: { email, nomeContato, nomeFantasia, token, expiraEm },
  })

  try {
    await enviarConviteParceiro({ para: email, nomeContato, nomeFantasia, token })
  } catch (err) {
    console.error('[convidar] Falha ao enviar email:', err)
  }

  return NextResponse.json({ ok: true })
}
