import { NextRequest, NextResponse } from 'next/server'
import { getSessao, hashSenha } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const sessao = await getSessao()
  if (!sessao || sessao.role !== 'superadmin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const { rows } = await query('SELECT * FROM tenants ORDER BY criado_em DESC')
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const sessao = await getSessao()
  if (!sessao || sessao.role !== 'superadmin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const { nome, email, senha, slug } = await req.json()

  if (!nome || !email || !senha || !slug) {
    return NextResponse.json({ erro: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const senhaHash = await hashSenha(senha)

  const { rows } = await query(
    'INSERT INTO tenants (nome, email, slug) VALUES ($1, $2, $3) RETURNING id',
    [nome, email, slug]
  )
  const tenantId = rows[0].id

  await query(
    'INSERT INTO tenant_users (tenant_id, email, senha_hash) VALUES ($1, $2, $3)',
    [tenantId, email, senhaHash]
  )

  return NextResponse.json({ id: tenantId })
}
