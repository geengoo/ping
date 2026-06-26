import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, cnpj, nomeFantasia, razaoSocial, contatoNome, contatoCargo, contatoTelefone, webhookUrl } = body

  if (!token || !nomeFantasia || !contatoNome) {
    return NextResponse.json({ erro: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const convite = await prisma.conviteParceiro.findFirst({
    where: { token, usado: false, expiraEm: { gt: new Date() } },
  })

  if (!convite) {
    return NextResponse.json({ erro: 'Convite inválido ou expirado' }, { status: 400 })
  }

  if (cnpj) {
    const cnpjExistente = await prisma.parceiro.findUnique({ where: { cnpj } })
    if (cnpjExistente) {
      return NextResponse.json({ erro: 'CNPJ já cadastrado' }, { status: 409 })
    }
  }

  let conta = await prisma.conta.findUnique({ where: { email: convite.email } })
  if (!conta) {
    conta = await prisma.conta.create({
      data: { email: convite.email, nome: contatoNome, papeis: [] },
    })
  }

  const parceiroExistente = await prisma.parceiro.findUnique({ where: { contaId: conta.id } })
  if (parceiroExistente) {
    return NextResponse.json({ erro: 'Parceiro já cadastrado para este email' }, { status: 409 })
  }

  const apiKey = nanoid(32)

  await prisma.$transaction([
    prisma.parceiro.create({
      data: {
        contaId: conta.id,
        nomeFantasia,
        razaoSocial: razaoSocial || null,
        cnpj: cnpj || null,
        contatoNome,
        contatoCargo: contatoCargo || null,
        contatoTelefone: contatoTelefone || null,
        webhookUrl: webhookUrl || null,
        apiKey,
      },
    }),
    prisma.conviteParceiro.update({
      where: { token },
      data: { usado: true },
    }),
  ])

  return NextResponse.json({ ok: true })
}
