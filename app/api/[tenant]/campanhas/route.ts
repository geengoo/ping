import { NextRequest, NextResponse } from 'next/server'
import { getSessao } from '@/lib/auth'
import { query } from '@/lib/db'
import { slugify } from '@/lib/utils'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params
  const sessao = await getSessao()
  if (!sessao || (sessao.role !== 'superadmin' && sessao.slug !== tenant)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const { rows } = await query(
    `SELECT c.*, COUNT(p.id) as total_participantes
     FROM campanhas c
     JOIN tenants t ON t.id = c.tenant_id
     LEFT JOIN participantes p ON p.campanha_id = c.id
     WHERE t.slug = $1
     GROUP BY c.id
     ORDER BY c.criado_em DESC`,
    [tenant]
  )

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params
  const sessao = await getSessao()
  if (!sessao || (sessao.role !== 'superadmin' && sessao.slug !== tenant)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const { titulo, descricao, imagem_url, inicio_em, fim_em, recompensas } = await req.json()

  const { rows: tenantRows } = await query('SELECT id FROM tenants WHERE slug = $1', [tenant])
  if (!tenantRows[0]) return NextResponse.json({ erro: 'Tenant não encontrado' }, { status: 404 })

  const slug = slugify(titulo)

  const { rows } = await query(
    `INSERT INTO campanhas (tenant_id, slug, titulo, descricao, imagem_url, inicio_em, fim_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, slug`,
    [tenantRows[0].id, slug, titulo, descricao, imagem_url, inicio_em || null, fim_em || null]
  )

  const campanhaId = rows[0].id

  if (recompensas?.length) {
    for (const [i, r] of recompensas.entries()) {
      await query(
        'INSERT INTO recompensas (campanha_id, min_indicacoes, titulo, descricao, ordem) VALUES ($1, $2, $3, $4, $5)',
        [campanhaId, r.min_indicacoes, r.titulo, r.descricao || '', i]
      )
    }
  }

  return NextResponse.json(rows[0])
}
