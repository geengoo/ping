import { NextRequest, NextResponse } from 'next/server'
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest) {
  const sessao = await getSessaoParceiro()
  if (!sessao) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })

  let body: { slug?: string; urlDestino?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const { slug, urlDestino } = body

  if (urlDestino !== undefined) {
    const url = urlDestino.trim()
    if (url && !url.startsWith('http')) {
      return NextResponse.json({ erro: 'URL deve começar com http:// ou https://' }, { status: 400 })
    }
    await prisma.parceiro.update({
      where: { id: sessao.parceiroId },
      data: { urlDestino: url || null },
    })
    return NextResponse.json({ ok: true })
  }

  if (!slug) return NextResponse.json({ erro: 'Slug obrigatório' }, { status: 400 })

  const slugNormalizado = slug
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')

  if (slugNormalizado.length < 2) {
    return NextResponse.json({ erro: 'URL muito curta (mínimo 2 caracteres)' }, { status: 400 })
  }

  const existente = await prisma.parceiro.findFirst({
    where: { slug: slugNormalizado, id: { not: sessao.parceiroId } },
  })
  if (existente) {
    return NextResponse.json({ erro: 'Esta URL já está em uso' }, { status: 409 })
  }

  await prisma.parceiro.update({
    where: { id: sessao.parceiroId },
    data: { slug: slugNormalizado },
  })

  return NextResponse.json({ ok: true, slug: slugNormalizado })
}
