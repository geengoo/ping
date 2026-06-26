import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { Prisma } from '@prisma/client'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const {
    token, cnpj, nomeFantasia, razaoSocial, contatoNome, contatoCargo, contatoTelefone, webhookUrl,
    nomeCampanha, recompensaTipo, recompensaValorCentavos, janelaCancelamentoDias, diaPagamento,
  } = body as {
    token?: string; cnpj?: string; nomeFantasia?: string; razaoSocial?: string
    contatoNome?: string; contatoCargo?: string; contatoTelefone?: string; webhookUrl?: string
    nomeCampanha?: string; recompensaTipo?: string; recompensaValorCentavos?: number
    janelaCancelamentoDias?: number; diaPagamento?: number
  }

  if (!token || !nomeFantasia || !contatoNome) {
    return NextResponse.json({ erro: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  if (!nomeCampanha || !recompensaTipo || recompensaValorCentavos == null || recompensaValorCentavos <= 0) {
    return NextResponse.json({ erro: 'Dados da campanha obrigatórios' }, { status: 400 })
  }

  if (!['pix', 'credito'].includes(recompensaTipo)) {
    return NextResponse.json({ erro: 'Tipo de recompensa inválido' }, { status: 400 })
  }

  if (webhookUrl && !String(webhookUrl).startsWith('https://')) {
    return NextResponse.json({ erro: 'Webhook URL deve usar HTTPS' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const convite = await tx.conviteParceiro.findFirst({
        where: { token, usado: false, expiraEm: { gt: new Date() } },
      })
      if (!convite) throw new Error('CONVITE_INVALIDO')

      if (cnpj) {
        const cnpjExistente = await tx.parceiro.findUnique({ where: { cnpj } })
        if (cnpjExistente) throw new Error('CNPJ_DUPLICADO')
      }

      let conta = await tx.conta.findUnique({ where: { email: convite.email } })
      if (!conta) {
        conta = await tx.conta.create({
          data: { email: convite.email, nome: contatoNome, papeis: [] },
        })
      }

      const parceiroExistente = await tx.parceiro.findUnique({ where: { contaId: conta.id } })
      if (parceiroExistente) throw new Error('PARCEIRO_EXISTENTE')

      const apiKey = nanoid(32)
      const slugBase = (nomeFantasia as string)
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      let slug = slugBase
      let tentativa = 0
      while (await tx.parceiro.findUnique({ where: { slug } })) {
        tentativa++
        slug = `${slugBase}-${tentativa}`
      }

      const parceiro = await tx.parceiro.create({
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
          slug,
        },
      })

      await tx.campanha.create({
        data: {
          parceiroId: parceiro.id,
          nome: nomeCampanha as string,
          recompensaTipo: recompensaTipo as string,
          recompensaValorCentavos: recompensaValorCentavos as number,
          janelaCancelamentoDias: (janelaCancelamentoDias as number) ?? 30,
          diaPagamento: (diaPagamento as number) ?? 5,
          tiposCompraElegiveis: [],
        },
      })

      await tx.conviteParceiro.update({
        where: { token },
        data: { usado: true },
      })
    })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'CONVITE_INVALIDO') return NextResponse.json({ erro: 'Convite inválido ou expirado' }, { status: 400 })
      if (err.message === 'CNPJ_DUPLICADO') return NextResponse.json({ erro: 'CNPJ já cadastrado' }, { status: 409 })
      if (err.message === 'PARCEIRO_EXISTENTE') return NextResponse.json({ erro: 'Parceiro já cadastrado para este email' }, { status: 409 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ erro: 'Dados duplicados' }, { status: 409 })
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}
