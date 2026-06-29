import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const parceiro = await prisma.parceiro.findUnique({
    where: { slug },
    include: { campanhas: { where: { status: 'ativa' }, take: 1 } },
  })

  if (!parceiro || parceiro.campanhas.length === 0) {
    return NextResponse.json({ erro: 'Parceiro não encontrado' }, { status: 404 })
  }

  let payload: { email?: string; nome?: string }
  try {
    const secret = new TextEncoder().encode(parceiro.apiKey)
    const { payload: p } = await jwtVerify(body.token || '', secret)
    payload = p as { email?: string; nome?: string }
  } catch {
    return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
  }

  const { email, nome } = payload
  if (!email || !nome) {
    return NextResponse.json({ erro: 'Token incompleto' }, { status: 400 })
  }

  const campanha = parceiro.campanhas[0]

  let conta = await prisma.conta.findUnique({ where: { email } })
  if (!conta) {
    conta = await prisma.conta.create({
      data: { email, nome, papeis: ['afiliado'] },
    })
  } else if (!conta.papeis.includes('afiliado')) {
    await prisma.conta.update({
      where: { id: conta.id },
      data: { papeis: { push: 'afiliado' } },
    })
  }

  let participacao = await prisma.participacao.findUnique({
    where: { campanhaId_afiliadoId: { campanhaId: campanha.id, afiliadoId: conta.id } },
  })

  if (!participacao) {
    const codigo = nanoid(8).toUpperCase()
    const urlBase = parceiro.urlDestino || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ping.geengoo.io'}/a`
    const linkIndicacao = parceiro.urlDestino
      ? `${parceiro.urlDestino}?ref=${codigo}`
      : `${urlBase}/${codigo}`
    participacao = await prisma.participacao.create({
      data: {
        campanhaId: campanha.id,
        afiliadoId: conta.id,
        codigoIndicacao: codigo,
        linkIndicacao,
      },
    })
  }

  const rewards = await prisma.reward.findMany({
    where: { participacaoId: participacao.id },
    select: { status: true, valorCentavos: true },
  })

  const saldo = {
    pendente: rewards.filter(r => r.status === 'pendente').reduce((s, r) => s + r.valorCentavos, 0),
    disponivel: rewards.filter(r => r.status === 'disponivel').reduce((s, r) => s + r.valorCentavos, 0),
    pago: rewards.filter(r => r.status === 'pago').reduce((s, r) => s + r.valorCentavos, 0),
  }

  const conversoes = await prisma.conversao.findMany({
    where: { participacaoId: participacao.id },
    orderBy: { criadoEm: 'desc' },
    take: 20,
    select: { criadoEm: true, produtoNome: true, valorCentavos: true, status: true },
  })

  return NextResponse.json({
    linkIndicacao: participacao.linkIndicacao,
    codigoIndicacao: participacao.codigoIndicacao,
    saldo,
    conversoes,
    campanha: {
      nome: campanha.nome,
      recompensaTipo: campanha.recompensaTipo,
      recompensaValorCentavos: campanha.recompensaValorCentavos,
    },
  })
}
