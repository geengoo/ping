import { NextRequest, NextResponse } from 'next/server'
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest) {
  const sessao = await getSessaoParceiro()
  if (!sessao) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const { campanhaId, nome, recompensaTipo, recompensaValorCentavos, janelaCancelamentoDias, diaPagamento } = body as {
    campanhaId?: string
    nome?: string
    recompensaTipo?: string
    recompensaValorCentavos?: number
    janelaCancelamentoDias?: number
    diaPagamento?: number
  }

  if (!campanhaId || !nome || !recompensaTipo || recompensaValorCentavos == null) {
    return NextResponse.json({ erro: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  if (!['pix', 'credito'].includes(recompensaTipo)) {
    return NextResponse.json({ erro: 'Tipo de recompensa inválido' }, { status: 400 })
  }

  if (recompensaValorCentavos <= 0) {
    return NextResponse.json({ erro: 'Valor da recompensa deve ser positivo' }, { status: 400 })
  }

  const campanha = await prisma.campanha.findUnique({ where: { id: campanhaId } })
  if (!campanha || campanha.parceiroId !== sessao.parceiroId) {
    return NextResponse.json({ erro: 'Campanha não encontrada' }, { status: 404 })
  }

  await prisma.campanha.update({
    where: { id: campanhaId },
    data: {
      nome,
      recompensaTipo,
      recompensaValorCentavos,
      janelaCancelamentoDias: janelaCancelamentoDias ?? campanha.janelaCancelamentoDias,
      diaPagamento: diaPagamento ?? campanha.diaPagamento,
    },
  })

  return NextResponse.json({ ok: true })
}
