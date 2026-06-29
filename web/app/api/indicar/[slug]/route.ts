import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarEmail } from '@/lib/resend'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let body: { nome?: string; email?: string; chavePix?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const { nome, email } = body
  if (!nome || !email) {
    return NextResponse.json({ erro: 'Nome e email são obrigatórios' }, { status: 400 })
  }

  const parceiro = await prisma.parceiro.findUnique({
    where: { slug },
    include: { campanhas: { where: { status: 'ativa' }, take: 1 } },
  })

  if (!parceiro || parceiro.campanhas.length === 0) {
    return NextResponse.json({ erro: 'Programa de indicações não encontrado' }, { status: 404 })
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

  const existente = await prisma.participacao.findUnique({
    where: { campanhaId_afiliadoId: { campanhaId: campanha.id, afiliadoId: conta.id } },
  })
  if (existente) {
    return NextResponse.json({ linkIndicacao: existente.linkIndicacao }, { status: 200 })
  }

  const codigo = nanoid(8).toUpperCase()
  const linkIndicacao = parceiro.urlDestino
    ? `${parceiro.urlDestino}?ref=${codigo}`
    : `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ping.geengoo.io'}/a/${codigo}`

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: conta.id,
      codigoIndicacao: codigo,
      linkIndicacao,
    },
  })

  const fmt = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const nomeParceiro = parceiro.nomeFantasia || parceiro.razaoSocial || 'Parceiro'

  try {
    await enviarEmail(
      email,
      `Seu link de indicação — ${nomeParceiro}`,
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:20px;font-weight:700;color:#111;margin:0 0 8px">Você está dentro, ${nome.split(' ')[0]}!</h2>
        <p style="color:#555;font-size:15px;margin:0 0 24px">
          Compartilhe seu link e ganhe ${fmt(campanha.recompensaValorCentavos)} por cada indicação confirmada.
        </p>
        <div style="background:#f4f4f5;border-radius:10px;padding:16px;font-family:monospace;font-size:14px;word-break:break-all;color:#111;margin-bottom:24px">
          ${linkIndicacao}
        </div>
        <a href="${linkIndicacao}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
          Acessar meu link
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">
          Programa de indicações via <strong>ping</strong> · ${nomeParceiro}
        </p>
      </div>`
    )
  } catch (err) {
    console.error('[indicar] Falha ao enviar email:', err)
  }

  return NextResponse.json({ linkIndicacao: participacao.linkIndicacao }, { status: 201 })
}
