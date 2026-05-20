import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenant: string; campanha: string }> }
) {
  const { tenant, campanha } = await params

  const { rows } = await query(
    `SELECT c.id, c.titulo, c.descricao, c.imagem_url, c.ativa
     FROM campanhas c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE t.slug = $1 AND c.slug = $2`,
    [tenant, campanha]
  )

  if (!rows[0]) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })

  const { rows: recompensas } = await query(
    'SELECT min_indicacoes, titulo, descricao FROM recompensas WHERE campanha_id = $1 ORDER BY min_indicacoes',
    [rows[0].id]
  )

  return NextResponse.json({ ...rows[0], recompensas })
}
