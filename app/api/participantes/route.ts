import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { gerarCodigo } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const { nome, email, campanha_id, codigo_indicador } = await req.json()

  if (!nome || !email || !campanha_id) {
    return NextResponse.json({ erro: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  let indicado_por: number | null = null
  if (codigo_indicador) {
    const { rows } = await query(
      'SELECT id FROM participantes WHERE codigo = $1 AND campanha_id = $2',
      [codigo_indicador, campanha_id]
    )
    if (rows[0]) indicado_por = rows[0].id
  }

  const codigo = gerarCodigo()

  try {
    const { rows } = await query(
      `INSERT INTO participantes (campanha_id, nome, email, codigo, indicado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, codigo`,
      [campanha_id, nome, email, codigo, indicado_por]
    )
    return NextResponse.json(rows[0])
  } catch {
    return NextResponse.json({ erro: 'Email já cadastrado nesta campanha' }, { status: 409 })
  }
}
