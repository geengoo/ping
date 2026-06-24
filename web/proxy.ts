import { NextRequest, NextResponse } from 'next/server'
import { verificarToken } from './lib/auth'

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('ping_token')?.value

  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')
  const isAfiliadoRoute =
    req.nextUrl.pathname.startsWith('/a/') &&
    !req.nextUrl.pathname.startsWith('/a/login')

  if (!isAdminRoute && !isAfiliadoRoute) return NextResponse.next()

  if (!token) return NextResponse.redirect(new URL('/a/login', req.url))

  const sessao = await verificarToken(token)
  if (!sessao) return NextResponse.redirect(new URL('/a/login', req.url))

  if (isAdminRoute && !sessao.papeis.includes('superadmin')) {
    return NextResponse.redirect(new URL('/a/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/a/:path*'],
}
