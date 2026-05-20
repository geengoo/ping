import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params

  const { rows } = await query(
    `SELECT
       p.nome, p.codigo,
       COUNT(ind.id) as total_indicacoes,
       c.titulo as campanha_titulo,
       c.slug as campanha_slug,
       t.slug as tenant_slug
     FROM participantes p
     JOIN campanhas c ON c.id = p.campanha_id
     JOIN tenants t ON t.id = c.tenant_id
     LEFT JOIN participantes ind ON ind.indicado_por = p.id
     WHERE p.codigo = $1
     GROUP BY p.id, c.id, t.id`,
    [codigo]
  )

  if (!rows[0]) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })

  const { rows: recompensas } = await query(
    `SELECT min_indicacoes, titulo, descricao
     FROM recompensas r
     JOIN campanhas c ON c.id = r.campanha_id
     JOIN participantes p ON p.campanha_id = c.id
     WHERE p.codigo = $1
     ORDER BY min_indicacoes`,
    [codigo]
  )

  return NextResponse.json({ participante: rows[0], recompensas })
}
