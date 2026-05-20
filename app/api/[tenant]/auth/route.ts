import { NextRequest, NextResponse } from 'next/server'
import { gerarToken, setTokenCookie, verificarSenha } from '@/lib/auth'
import { query } from '@/lib/db'
import { cookies } from 'next/headers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params
  const { email, senha } = await req.json()

  const { rows } = await query(
    `SELECT tu.*, t.slug FROM tenant_users tu
     JOIN tenants t ON t.id = tu.tenant_id
     WHERE tu.email = $1 AND t.slug = $2`,
    [email, tenant]
  )

  if (!rows[0]) {
    return NextResponse.json({ erro: 'Credenciais inválidas' }, { status: 401 })
  }

  const ok = await verificarSenha(senha, rows[0].senha_hash)
  if (!ok) {
    return NextResponse.json({ erro: 'Credenciais inválidas' }, { status: 401 })
  }

  const token = gerarToken({ role: 'tenant', tenantId: rows[0].tenant_id, slug: tenant })
  const cookieOptions = setTokenCookie(token)
  const jar = await cookies()
  jar.set(cookieOptions)

  return NextResponse.json({ ok: true })
}
