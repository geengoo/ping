import { NextRequest, NextResponse } from 'next/server'
import { verificarToken } from './lib/auth'
import { verificarTokenParceiro } from './lib/parceiroAuth'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAfiliadoRoute = pathname.startsWith('/a/') && !pathname.startsWith('/a/login')
  const isAdminRoute = pathname.startsWith('/admin')
  const isParceiroRoute = pathname.startsWith('/parceiro/') && !pathname.startsWith('/parceiro/login')

  if (isAfiliadoRoute || isAdminRoute) {
    const token = req.cookies.get('ping_token')?.value
    if (!token) return NextResponse.redirect(new URL('/a/login', req.url))
    const sessao = await verificarToken(token)
    if (!sessao) return NextResponse.redirect(new URL('/a/login', req.url))
    if (isAdminRoute && !sessao.papeis.includes('superadmin')) {
      return NextResponse.redirect(new URL('/a/login', req.url))
    }
    return NextResponse.next()
  }

  if (isParceiroRoute) {
    const token = req.cookies.get('ping_parceiro_token')?.value
    if (!token) return NextResponse.redirect(new URL('/parceiro/login', req.url))
    const sessao = await verificarTokenParceiro(token)
    if (!sessao) return NextResponse.redirect(new URL('/parceiro/login', req.url))
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/a/:path*', '/parceiro/:path*'],
}
