import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json(null)

  const convite = await prisma.conviteParceiro.findFirst({
    where: { token, usado: false, expiraEm: { gt: new Date() } },
    select: { email: true, nomeContato: true, nomeFantasia: true },
  })

  if (!convite) return NextResponse.json(null)

  return NextResponse.json({
    email: convite.email,
    nomeContato: convite.nomeContato,
    nomeFantasia: convite.nomeFantasia,
  })
}
